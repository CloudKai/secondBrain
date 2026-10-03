-- User-supplied transcripts extend the existing owned source/study workflow.
begin;
alter table public.sources drop constraint sources_source_kind_check;
alter table public.sources add constraint sources_source_kind_check check (source_kind in ('article','pdf','video'));
alter table public.sources add column transcript jsonb;

create function public.valid_video_transcript(p_transcript jsonb,p_text text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_segment jsonb; v_format text; v_end integer := -1; v_start integer; v_last integer;
  v_time integer := -1; v_start_ms integer; v_end_ms integer;
begin
  if p_transcript is null or jsonb_typeof(p_transcript) <> 'object'
    or octet_length(p_transcript::text) > 256000
    or (select count(*) from jsonb_object_keys(p_transcript)) <> 4
    or not (p_transcript ?& array['provider','format','filename','segments'])
    or jsonb_typeof(p_transcript->'provider') <> 'string'
    or p_transcript->>'provider' not in ('youtube','teams','zoom','panopto')
    or jsonb_typeof(p_transcript->'format') <> 'string'
    or p_transcript->>'format' not in ('text','vtt','srt')
    or jsonb_typeof(p_transcript->'segments') <> 'array'
    or jsonb_array_length(p_transcript->'segments') not between 1 and 2000 then return false; end if;
  if p_transcript->'filename' <> 'null'::jsonb and
    (jsonb_typeof(p_transcript->'filename') <> 'string' or char_length(p_transcript->>'filename') not between 1 and 200) then return false; end if;
  v_format := p_transcript->>'format';
  if v_format = 'text' and jsonb_array_length(p_transcript->'segments') <> 1 then return false; end if;
  for v_segment in select value from jsonb_array_elements(p_transcript->'segments') loop
    if jsonb_typeof(v_segment) <> 'object' or (select count(*) from jsonb_object_keys(v_segment)) <> 4
      or not (v_segment ?& array['start','end','start_ms','end_ms'])
      or jsonb_typeof(v_segment->'start') <> 'number' or jsonb_typeof(v_segment->'end') <> 'number'
      or not ((v_segment->>'start') ~ '^[0-9]+$' and (v_segment->>'end') ~ '^[0-9]+$') then return false; end if;
    v_start := (v_segment->>'start')::integer; v_last := (v_segment->>'end')::integer;
    if v_start <> v_end + 1 or v_last <= v_start or v_last > char_length(p_text) then return false; end if;
    if v_format = 'text' then
      if v_segment->'start_ms' <> 'null'::jsonb or v_segment->'end_ms' <> 'null'::jsonb then return false; end if;
    else
      if jsonb_typeof(v_segment->'start_ms') <> 'number' or jsonb_typeof(v_segment->'end_ms') <> 'number'
        or not ((v_segment->>'start_ms') ~ '^[0-9]+$' and (v_segment->>'end_ms') ~ '^[0-9]+$') then return false; end if;
      v_start_ms := (v_segment->>'start_ms')::integer; v_end_ms := (v_segment->>'end_ms')::integer;
      if v_start_ms < v_time or v_end_ms <= v_start_ms or v_end_ms > 604800000 then return false; end if;
      v_time := v_start_ms;
    end if;
    v_end := v_last;
  end loop;
  return v_end = char_length(p_text);
exception when others then return false;
end;
$$;
revoke execute on function public.valid_video_transcript(jsonb,text) from public,anon;
grant execute on function public.valid_video_transcript(jsonb,text) to authenticated,service_role;

alter table public.sources drop constraint sources_document_identity_check;
alter table public.sources add constraint sources_document_identity_check check (
  (source_kind = 'article' and original_url is not null and canonical_url ~ '^https?://' and document is null and transcript is null and capture_origin <> 'upload')
  or (source_kind = 'pdf' and transcript is null and public.valid_pdf_document(document,captured_text) and
    ((capture_origin = 'upload' and original_url is null and canonical_url ~ '^urn:pdf:sha256:[a-f0-9]{64}$' and document->>'filename' is not null)
     or (capture_origin = 'direct' and original_url is not null and canonical_url ~ '^https?://')))
  or (source_kind = 'video' and original_url is not null and canonical_url ~ '^https://' and document is null
    and coverage in ('unknown','partial') and public.valid_video_transcript(transcript,captured_text)
    and ((capture_origin = 'pasted' and transcript->'filename' = 'null'::jsonb)
      or (capture_origin = 'upload' and transcript->>'filename' is not null)))
);

create or replace function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_study public.source_studies; v_text text; v_document jsonb; v_transcript jsonb;
begin
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text,document,transcript into v_text,v_document,v_transcript from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'captured_text',v_text,'document',v_document,'transcript',v_transcript,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;
-- CREATE OR REPLACE preserves the existing service-only worker grants and RLS.
commit;
