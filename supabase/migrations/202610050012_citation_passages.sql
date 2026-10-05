-- Stop existing workers before applying; restart with the matching backend.
-- Existing jobs retain the immutable legacy grouping, including in-flight work.
begin;
lock table public.source_studies in share row exclusive mode;
create table public.study_passage_policies (
 source_id uuid not null references public.sources(id) on delete cascade,
 source_version integer not null check(source_version between 1 and 20),
 policy text not null check(policy in ('legacy','thought_v1')),
 primary key(source_id,source_version)
);
alter table public.study_passage_policies enable row level security;
revoke all on public.study_passage_policies from public,anon,authenticated;
grant select,insert on public.study_passage_policies to service_role;
insert into public.study_passage_policies(source_id,source_version,policy)
 select source_id,source_version,'legacy' from public.source_studies;

create or replace function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_user uuid;v_study public.source_studies; v_text text; v_document jsonb; v_transcript jsonb;
begin
  select user_id into v_user from public.sources where id=p_source_id;
  if not found then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  insert into public.study_passage_policies(source_id,source_version,policy)
    values(p_source_id,v_study.source_version,'thought_v1')
    on conflict(source_id,source_version) do nothing;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text,document,transcript into v_text,v_document,v_transcript from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'source_version',v_study.source_version,
    'passage_policy',(select policy from public.study_passage_policies where source_id=p_source_id and source_version=v_study.source_version),
    'completed_sections',(select coalesce(jsonb_agg(summary order by section_index),'[]') from public.study_sections where source_id=p_source_id and source_version=v_study.source_version),
    'captured_text',v_text,'document',v_document,'transcript',v_transcript,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;

revoke execute on function public.claim_source_study(uuid) from public,anon,authenticated;
grant execute on function public.claim_source_study(uuid) to service_role;
commit;
