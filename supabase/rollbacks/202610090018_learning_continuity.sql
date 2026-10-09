-- Revert the application/API before this compatibility rollback.
-- Keep selection metadata, trigger, index and all learning/source data.
begin;
revoke execute on function public.get_learning_summary() from authenticated;
revoke execute on function public.select_learning_lesson_checked(uuid,integer,bigint) from authenticated;
create or replace function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;plans jsonb;
begin
 result:=public.get_source_learning_v1(p_source_id);
 select coalesce(jsonb_agg(item||jsonb_build_object('branch_of_plan_id',n.branch_of_plan_id,'evidence',n.evidence,'source_members',n.source_members,'revision',n.revision,'base_plan_id',n.base_plan_id,'needs_review',not public.learning_plan_current(n.id)) order by n.created_at,n.id),'[]') into plans
 from jsonb_array_elements(result->'plans') item join public.learning_plans n on n.id=(item->>'id')::uuid and n.user_id=auth.uid();
 return result||jsonb_build_object('plans',plans,'selected_plan_id',(select plan_id from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),'selected_lesson_index',coalesce((select lesson_index from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),0));
end;$$;

commit;
