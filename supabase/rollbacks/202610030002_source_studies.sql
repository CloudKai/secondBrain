-- Removes generated notes/jobs; preserves saved source captures.
begin;
drop function public.finish_source_study(uuid,uuid,jsonb,text);
drop function public.claim_source_study(uuid);
drop function public.ack_study_dispatch(uuid);
drop function public.due_study_dispatches(integer);
drop function public.request_source_study(uuid,boolean);
drop table public.study_outbox;
drop table public.source_studies;
alter table public.sources drop constraint sources_id_owner;
commit;
