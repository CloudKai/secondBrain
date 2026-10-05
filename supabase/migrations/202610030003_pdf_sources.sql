-- Extend the existing owned-source workflow with bounded PDF page text.
begin;
alter table public.sources alter column original_url drop not null;
alter table public.sources drop constraint sources_canonical_url_check;
alter table public.sources drop constraint sources_capture_origin_check;
alter table public.sources add column source_kind text not null default 'article'
  check (source_kind in ('article','pdf'));
alter table public.sources add column document jsonb;
alter table public.sources add constraint sources_canonical_url_check
  check (canonical_url ~ '^https?://' or canonical_url ~ '^urn:pdf:sha256:[a-f0-9]{64}$');
alter table public.sources add constraint sources_capture_origin_check
  check (capture_origin in ('direct','reader','pasted','upload'));

create function public.valid_pdf_document(p_document jsonb,p_text text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_page jsonb; v_count integer; v_index integer := 0; v_end integer := -1; v_start integer; v_last integer;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or octet_length(p_document::text) > 16384
    or (select count(*) from jsonb_object_keys(p_document)) <> 3
    or not (p_document ?& array['filename','page_count','pages'])
    or jsonb_typeof(p_document->'page_count') <> 'number'
    or not ((p_document->>'page_count') ~ '^[0-9]+$')
    or jsonb_typeof(p_document->'pages') <> 'array' then return false; end if;
  if p_document->'filename' <> 'null'::jsonb and
    (jsonb_typeof(p_document->'filename') <> 'string' or char_length(p_document->>'filename') not between 1 and 200) then return false; end if;
  v_count := (p_document->>'page_count')::integer;
  if v_count not between 1 and 100 or jsonb_array_length(p_document->'pages') not between 1 and v_count then return false; end if;
  for v_page in select value from jsonb_array_elements(p_document->'pages') loop
    v_index := v_index + 1;
    if jsonb_typeof(v_page) <> 'object' or (select count(*) from jsonb_object_keys(v_page)) <> 3
      or not (v_page ?& array['page','start','end'])
      or jsonb_typeof(v_page->'page') <> 'number' or jsonb_typeof(v_page->'start') <> 'number' or jsonb_typeof(v_page->'end') <> 'number'
      or not ((v_page->>'page') ~ '^[0-9]+$' and (v_page->>'start') ~ '^[0-9]+$' and (v_page->>'end') ~ '^[0-9]+$') then return false; end if;
    v_start := (v_page->>'start')::integer; v_last := (v_page->>'end')::integer;
    if (v_page->>'page')::integer <> v_index or v_start <> v_end + 1 or v_last < v_start or v_last > char_length(p_text) then return false; end if;
    v_end := v_last;
  end loop;
  return v_end = char_length(p_text);
exception when others then return false;
end;
$$;
revoke execute on function public.valid_pdf_document(jsonb,text) from public,anon;
grant execute on function public.valid_pdf_document(jsonb,text) to authenticated,service_role;

alter table public.sources add constraint sources_document_identity_check check (
  (source_kind = 'article' and original_url is not null and canonical_url ~ '^https?://' and document is null and capture_origin <> 'upload')
  or (source_kind = 'pdf' and public.valid_pdf_document(document,captured_text) and
    ((capture_origin = 'upload' and original_url is null and canonical_url ~ '^urn:pdf:sha256:[a-f0-9]{64}$' and document->>'filename' is not null)
     or (capture_origin = 'direct' and original_url is not null and canonical_url ~ '^https?://')))
);

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

-- Existing RLS and service-only function grants remain in effect.
commit;
