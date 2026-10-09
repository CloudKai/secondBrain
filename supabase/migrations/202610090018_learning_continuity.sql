-- Additive continuity metadata; legacy places retain unknown selection time.
begin;
alter table public.learning_places add column selected_at timestamptz;
alter table public.learning_places add column revision bigint not null default 0 check(revision>=0);
create function public.timestamp_learning_place() returns trigger
language plpgsql set search_path='' as $$
begin
 new.selected_at:=clock_timestamp();
 new.revision:=case when tg_op='UPDATE' then old.revision+1 else 1 end;
 return new;
end;$$;
revoke execute on function public.timestamp_learning_place() from public,anon,authenticated;
create trigger learning_place_timestamp before insert or update on public.learning_places
for each row execute function public.timestamp_learning_place();
create index learning_places_recent on public.learning_places(user_id,selected_at desc) where selected_at is not null;

create function public.select_learning_lesson_checked(p_plan_id uuid,p_lesson_index integer,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;root uuid;version bigint;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='Plan not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid() and confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select original_source_id into root from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select revision into version from public.learning_places where user_id=auth.uid() and original_source_id=root;
 if p_expected_revision is null or p_expected_revision<>coalesce(version,0) then
  raise exception using errcode='40001',message='Learning place changed. Reload before choosing a lesson';
 end if;
 return public.select_learning_lesson(p_plan_id,p_lesson_index);
end;$$;
revoke execute on function public.select_learning_lesson_checked(uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.select_learning_lesson_checked(uuid,integer,bigint) to authenticated;

create or replace function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;plans jsonb;
begin
 result:=public.get_source_learning_v1(p_source_id);
 select coalesce(jsonb_agg(item||jsonb_build_object('branch_of_plan_id',n.branch_of_plan_id,'evidence',n.evidence,'source_members',n.source_members,'revision',n.revision,'base_plan_id',n.base_plan_id,'needs_review',not public.learning_plan_current(n.id)) order by n.created_at,n.id),'[]') into plans
 from jsonb_array_elements(result->'plans') item join public.learning_plans n on n.id=(item->>'id')::uuid and n.user_id=auth.uid();
 return result||jsonb_build_object('plans',plans,
 'selected_plan_id',(select plan_id from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),
 'selected_lesson_index',coalesce((select lesson_index from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),0),
 'selected_place_revision',coalesce((select revision from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),0));
end;$$;

create function public.get_learning_summary() returns jsonb
language plpgsql security definer set search_path='' as $$
declare place jsonb;studied bigint;attempts bigint;provisional bigint;pending bigint;failed bigint;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='Learning history not found';end if;
 select jsonb_build_object('source_id',p.original_source_id,
 'source_available',exists(select 1 from public.sources s where s.id=p.original_source_id and s.user_id=auth.uid()),
 'source_title',p.source_title,'plan_id',n.id,'path_id',p.id,'plan_title',n.content->>'title','goal',n.goal,
 'lesson_index',l.lesson_index,'lesson_title',n.content->'lessons'->l.lesson_index->>'title',
 'needs_review',not public.learning_plan_current(n.id),'selected_at',l.selected_at,'place_revision',l.revision) into place
 from public.learning_places l join public.learning_plans n on n.id=l.plan_id and n.user_id=l.user_id
 join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id and p.original_source_id=l.original_source_id
 where l.user_id=auth.uid() and l.selected_at is not null and n.confirmed_at is not null
 and l.lesson_index<jsonb_array_length(n.content->'lessons')
 order by l.selected_at desc,l.original_source_id limit 1;
 select count(*) into studied from public.learning_activities a join public.learning_plans n on n.id=a.plan_id and n.user_id=a.user_id
 where a.user_id=auth.uid() and a.kind='read' and n.confirmed_at is not null;
 select count(*),count(*) filter(where a.status='needs_review'),count(*) filter(where a.status='pending'),count(*) filter(where a.status='failed')
 into attempts,provisional,pending,failed from public.learning_attempts a join public.learning_plans n on n.id=a.plan_id and n.user_id=a.user_id
 where a.user_id=auth.uid() and n.confirmed_at is not null;
 return jsonb_build_object('user_id',auth.uid(),'resume',place,'studied_lessons',studied,
 'practice_attempts',attempts,'provisional_checks',provisional,'pending_feedback',pending,'failed_feedback',failed);
end;$$;
revoke execute on function public.get_learning_summary() from public,anon,authenticated;
grant execute on function public.get_learning_summary() to authenticated;
commit;
