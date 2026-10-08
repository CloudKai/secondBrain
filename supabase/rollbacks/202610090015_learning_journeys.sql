-- Destructive rollback: deletes learning history only; sources/notes stay intact.
begin;
drop trigger if exists learning_source_removed on public.learning_paths;
drop function if exists public.clear_removed_learning_evidence();
drop function if exists public.get_learning_history(integer,integer);
drop function if exists public.record_learning_activity(uuid,integer,text);
drop function if exists public.finish_learning_feedback(uuid,uuid,jsonb);
drop function if exists public.claim_learning_feedback(uuid);
drop function if exists public.submit_learning_attempt(uuid,uuid,integer,text);
drop function if exists public.learning_plan_context(uuid);
drop function if exists public.confirm_learning_plan(uuid);
drop function if exists public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text);
drop function if exists public.request_learning_preview(uuid,integer,uuid,text,text,uuid);
drop function if exists public.get_source_learning(uuid);
alter table public.learning_paths drop constraint if exists learning_active_plan;
drop table if exists public.learning_activities,public.learning_attempts,public.learning_plans,public.learning_previews,public.learning_paths;
commit;
