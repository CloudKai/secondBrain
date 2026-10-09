-- Roll back only unused collection previews. Confirmed collection history
-- must first be exported and migrated; this script refuses to erase learner work.
begin;
-- Block source deletion, confirmation and attempt writes before checking history.
lock table public.sources,public.learning_paths,public.learning_plans,public.learning_attempts in access exclusive mode;
do $$ begin
 if exists(select 1 from public.learning_plans where jsonb_array_length(source_members)>0 and confirmed_at is not null)
 or exists(select 1 from public.learning_attempts a join public.learning_plans n on n.id=a.plan_id where jsonb_array_length(n.source_members)>0) then
  raise exception 'Export and migrate collection learner history before rollback';
 end if;
end;$$;
drop trigger learning_collection_source_removed on public.sources;
drop function public.clear_removed_collection_evidence();
drop function public.get_learning_candidates(uuid);
drop function public.request_learning_revision(uuid,uuid,uuid,integer,text);
drop function public.finish_learning_revision(uuid,uuid,jsonb,jsonb,text);
drop function public.get_source_learning(uuid);
alter function public.get_source_learning_v1(uuid) rename to get_source_learning;
grant execute on function public.get_source_learning(uuid) to authenticated;
drop function public.request_learning_preview(uuid,integer,uuid,text,text,uuid);
alter function public.request_learning_preview_v1(uuid,integer,uuid,text,text,uuid) rename to request_learning_preview;
grant execute on function public.request_learning_preview(uuid,integer,uuid,text,text,uuid) to authenticated;
drop function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text);
alter function public.finish_learning_preview_v1(uuid,uuid,jsonb,text,jsonb,text) rename to finish_learning_preview;
grant execute on function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text) to service_role;
drop function public.finish_learning_feedback(uuid,uuid,jsonb);
alter function public.finish_learning_feedback_v1(uuid,uuid,jsonb) rename to finish_learning_feedback;
grant execute on function public.finish_learning_feedback(uuid,uuid,jsonb) to service_role;
create or replace function public.confirm_learning_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans; p public.learning_paths; s public.sources;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into s from public.sources where id=p.source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 if n.source_version<>s.source_version then raise exception using errcode='40001',message='Plan evidence changed';end if;
 update public.learning_plans set confirmed_at=coalesce(confirmed_at,now()) where id=n.id;
 update public.learning_paths set active_plan_id=n.id where id=p.id;
 return public.get_source_learning(s.id);
end;$$;
create or replace function public.learning_plan_context(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans; p public.learning_paths; s public.sources;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into s from public.sources where id=p.source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 if n.source_version<>s.source_version or n.confirmed_at is null then raise exception using errcode='40001',message='Plan not confirmed or evidence changed';end if;
 return jsonb_build_object('source_id',s.id,'content',n.content,'difficulty',n.difficulty);
end;$$;
revoke execute on function public.learning_plan_context(uuid) from public,anon,authenticated;
revoke execute on function public.confirm_learning_plan(uuid) from public,anon;
grant execute on function public.confirm_learning_plan(uuid) to authenticated;
drop function public.learning_plan_current(uuid);
drop function public.learning_members_current(uuid,jsonb);
drop function public.learning_lock_members(uuid,jsonb);
drop function public.learning_confirmed_topics(uuid,uuid);
drop table public.learning_revisions;
-- These are unconfirmed previews only; confirmed history is guarded above.
delete from public.learning_plans where jsonb_array_length(source_members)>0;
alter table public.learning_plans drop column base_plan_id,drop column revision,drop column source_members,drop column evidence;
commit;
