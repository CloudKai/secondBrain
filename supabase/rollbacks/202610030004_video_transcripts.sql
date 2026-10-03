-- Refuse to discard learner transcript captures during rollback.
begin;
do $$ begin
  if exists (select 1 from public.sources where source_kind = 'video') then
    raise exception 'Video captures exist. Preserve/export them before intentionally removing the transcript schema.';
  end if;
end $$;
create or replace function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_study public.source_studies; v_text text; v_document jsonb;
begin
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text,document into v_text,v_document from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'captured_text',v_text,'document',v_document,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;
alter table public.sources drop constraint sources_document_identity_check;
alter table public.sources drop column transcript;
alter table public.sources drop constraint sources_source_kind_check;
alter table public.sources add constraint sources_source_kind_check check (source_kind in ('article','pdf'));
alter table public.sources add constraint sources_document_identity_check check (
  (source_kind = 'article' and original_url is not null and canonical_url ~ '^https?://' and document is null and capture_origin <> 'upload')
  or (source_kind = 'pdf' and public.valid_pdf_document(document,captured_text) and
    ((capture_origin = 'upload' and original_url is null and canonical_url ~ '^urn:pdf:sha256:[a-f0-9]{64}$' and document->>'filename' is not null)
     or (capture_origin = 'direct' and original_url is not null and canonical_url ~ '^https?://')))
);
drop function public.valid_video_transcript(jsonb,text);
commit;
