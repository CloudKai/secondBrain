-- Refuse rollback while PDF captures exist; never delete learner records here.
begin;
do $$begin
  if exists (select 1 from public.sources where source_kind='pdf') then
    raise exception 'PDF captures exist. Retain this schema or explicitly remove/export them before rollback.';
  end if;
end;$$;
create or replace function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_study public.source_studies; v_text text;
begin
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text into v_text from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'captured_text',v_text,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;

alter table public.sources drop constraint sources_document_identity_check;
alter table public.sources drop column document;
alter table public.sources drop column source_kind;
drop function public.valid_pdf_document(jsonb,text);
alter table public.sources alter column original_url set not null;
alter table public.sources drop constraint sources_canonical_url_check;
alter table public.sources add constraint sources_canonical_url_check check (canonical_url ~ '^https?://');
alter table public.sources drop constraint sources_capture_origin_check;
alter table public.sources add constraint sources_capture_origin_check check (capture_origin in ('direct','reader','pasted'));
commit;
