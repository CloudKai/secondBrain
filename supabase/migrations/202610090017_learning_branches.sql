-- Retained goal branches. No prior attempt completes a new check.
begin;
alter table public.learning_revisions add column goal text check(goal is null or char_length(btrim(goal)) between 1 and 500);
alter table public.learning_revisions drop constraint learning_revisions_members_check;
alter table public.learning_revisions add constraint learning_revisions_members_check check(jsonb_typeof(members)='array' and jsonb_array_length(members) between 1 and 8);
alter table public.learning_plans add column branch_of_plan_id uuid references public.learning_plans(id);

create table public.learning_places (
 user_id uuid not null references auth.users(id) on delete cascade,
 original_source_id uuid not null,
 plan_id uuid not null references public.learning_plans(id) on delete cascade,
 lesson_index integer not null check(lesson_index between 0 and 3),
 primary key(user_id,original_source_id)
);
alter table public.learning_places enable row level security;
revoke all on public.learning_places from public,anon,authenticated;

create function public.select_learning_lesson(p_plan_id uuid,p_lesson_index integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;p public.learning_paths;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid() and confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 if p_lesson_index is null or p_lesson_index<0 or p_lesson_index>=jsonb_array_length(n.content->'lessons') then raise exception using errcode='22023',message='Choose an available lesson';end if;
 perform pg_advisory_xact_lock(hashtextextended(n.user_id::text,0));
 insert into public.learning_places(user_id,original_source_id,plan_id,lesson_index) values(n.user_id,p.original_source_id,n.id,p_lesson_index)
 on conflict(user_id,original_source_id) do update set plan_id=excluded.plan_id,lesson_index=excluded.lesson_index;
 return public.get_source_learning(p.original_source_id);
end;$$;
revoke execute on function public.select_learning_lesson(uuid,integer) from public,anon,authenticated;
grant execute on function public.select_learning_lesson(uuid,integer) to authenticated;

drop function public.request_learning_revision(uuid,uuid,uuid,integer,text);
create function public.request_learning_revision(p_plan_id uuid,p_request_id uuid,p_source_id uuid,p_source_version integer,p_difficulty text default null,p_goal text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;p public.learning_paths;r public.learning_revisions;members jsonb;inputs jsonb;token uuid;ids jsonb;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into r from public.learning_revisions where id=p_request_id;
 if found then
  if r.user_id<>auth.uid() or r.base_plan_id<>n.id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.added_source_id is distinct from p_source_id or r.added_source_version is distinct from p_source_version or r.goal is distinct from p_goal or r.difficulty<>coalesce(p_difficulty,n.difficulty) then raise exception using errcode='40001',message='Request changed';end if;
  members:=r.members;
 else
  if n.confirmed_at is null or p.active_plan_id is distinct from n.id or not public.learning_plan_current(n.id) then raise exception using errcode='40001',message='Plan evidence changed';end if;
  if p_goal is not null then
   if char_length(btrim(p_goal)) not between 1 and 500 or p_goal<>btrim(p_goal) or p_goal=n.goal or p_source_id is not null or p_source_version is not null or p_difficulty is not null then raise exception using errcode='22023',message='Choose a distinct goal separately';end if;
  elsif p_source_id is null and (p_source_version is not null or p_difficulty is null or p_difficulty not in ('foundation','intermediate','advanced') or jsonb_array_length(n.source_members)<1) or p_source_id is not null and (p_source_version is null or p_difficulty is not null) then raise exception using errcode='22023',message='Choose source contribution or collection difficulty';end if;
  if p_source_id is not null and not exists(select 1 from jsonb_array_elements(public.get_learning_candidates(n.id)->'candidates') candidate where candidate->>'source_id'=p_source_id::text and (candidate->>'source_version')::integer=p_source_version) then raise exception using errcode='P0002',message='Related source not found';end if;
  ids:=case when jsonb_array_length(n.source_members)=0 then jsonb_build_array(p.source_id) else (select jsonb_agg(m->'source_id') from jsonb_array_elements(n.source_members) m) end||case when p_source_id is null then '[]'::jsonb else jsonb_build_array(p_source_id) end;
  if jsonb_array_length(ids)>8 then raise exception using errcode='54000',message='Collection source limit reached';end if;
  select jsonb_agg(jsonb_build_object('source_id',s.id,'source_version',s.source_version,'title',s.title,'topic_fingerprint',md5(public.learning_confirmed_topics(auth.uid(),s.id)::text)) order by ord) into members
  from jsonb_array_elements_text(ids) with ordinality member(id,ord) join public.sources s on s.id=member.id::uuid and s.user_id=auth.uid();
 end if;
 perform public.learning_lock_members(auth.uid(),members);
 if not public.learning_plan_current(n.id) or jsonb_array_length(members)<>(case when jsonb_array_length(n.source_members)=0 then 1 else jsonb_array_length(n.source_members) end+case when p_source_id is null then 0 else 1 end) or not public.learning_members_current(auth.uid(),members) then raise exception using errcode='40001',message='Source evidence changed';end if;
 if coalesce(r.status,'')<>'ready' and not exists(select 1 from public.learning_paths lp where lp.id=n.path_id and lp.user_id=auth.uid() and lp.active_plan_id=n.id) then raise exception using errcode='40001',message='Another plan was confirmed';end if;
 select * into r from public.learning_revisions where id=p_request_id for update;
 if found then
  if r.user_id<>auth.uid() or r.base_plan_id<>n.id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.added_source_id is distinct from p_source_id or r.added_source_version is distinct from p_source_version or r.goal is distinct from p_goal or r.difficulty<>coalesce(p_difficulty,n.difficulty) or r.members<>members then raise exception using errcode='40001',message='Request changed';end if;
  if r.status='ready' then token:=null;
  elsif r.status='processing' and r.lease_until>now() then raise exception using errcode='55P03',message='Revision is still generating';
  elsif r.attempts>=3 then raise exception using errcode='54000',message='Revision retry limit reached';
  else token:=gen_random_uuid();update public.learning_revisions set status='processing',lease_token=token,lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=r.id;end if;
 else
  if exists(select 1 from public.learning_revisions lr join public.learning_plans lp on lp.id=lr.base_plan_id where lr.user_id=auth.uid() and lp.path_id=n.path_id and lr.status='processing' and lr.lease_until>now()) then raise exception using errcode='55P03',message='Another revision is still generating';end if;
  if (select count(*) from public.learning_revisions where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception using errcode='54000',message='Revision generation limit';end if;
  token:=gen_random_uuid();insert into public.learning_revisions(id,user_id,base_plan_id,added_source_id,added_source_version,difficulty,members,status,lease_token,lease_until,goal) values(p_request_id,auth.uid(),n.id,p_source_id,p_source_version,coalesce(p_difficulty,n.difficulty),members,'processing',token,now()+interval '120 seconds',p_goal);
 end if;
 select jsonb_agg(jsonb_build_object('source',to_jsonb(s),'note',study.note) order by ord) into inputs from jsonb_array_elements(members) with ordinality member(m,ord)
 join public.sources s on s.id=(m->>'source_id')::uuid and s.user_id=auth.uid()
 join public.source_studies study on study.source_id=s.id and study.user_id=s.user_id and study.source_version=s.source_version and study.status='succeeded';
 if jsonb_array_length(inputs) is distinct from jsonb_array_length(members) then raise exception using errcode='40001',message='Wait for source notes';end if;
 return jsonb_build_object('user_id',auth.uid(),'source_id',p.original_source_id,'request_id',p_request_id,'lease_token',token,'sources',inputs,'mode',case when p_goal is not null then 'goal_branch' when p_source_id is null then 'difficulty' else 'add_source' end,'difficulty',coalesce(p_difficulty,n.difficulty),'goal',p_goal,'base_plan',(select plan from jsonb_array_elements(public.get_source_learning(p.original_source_id)->'plans') plan where plan->>'id'=n.id::text));
end;$$;
create or replace function public.finish_learning_revision(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_evidence jsonb,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.learning_revisions;n public.learning_plans;p public.learning_paths;v_e jsonb;refs jsonb;claim jsonb;citation jsonb;target_path uuid;
begin
 select * into r from public.learning_revisions where id=p_request_id and lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Request not found';end if;
 perform public.learning_lock_members(r.user_id,r.members);
 select * into r from public.learning_revisions where id=p_request_id for update;
 select * into n from public.learning_plans where id=r.base_plan_id and user_id=r.user_id;
 select * into p from public.learning_paths where id=n.path_id and user_id=r.user_id for update;
 if r.status<>'processing' or r.lease_token is distinct from p_lease_token or r.lease_until<=now() or p.active_plan_id is distinct from n.id or not public.learning_members_current(r.user_id,r.members) then raise exception using errcode='40001',message='Expired or changed revision';end if;
 if p_draft is null then update public.learning_revisions set status='failed',lease_token=null,lease_until=null where id=r.id;return true;end if;
 if p_model is null or p_model not in ('gpt-6-luna','gpt-6.1-sol') or jsonb_typeof(p_evidence) is distinct from 'array' or jsonb_array_length(p_evidence) not between 1 and 100 or octet_length(p_evidence::text)>262144 then raise exception using errcode='22023',message='Invalid revision evidence';end if;
 if (select count(*) from public.learning_plans lp join public.learning_paths paths on paths.id=lp.path_id where paths.original_source_id=p.original_source_id and paths.user_id=r.user_id)>=40 then raise exception using errcode='54000',message='Learning plan limit reached';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_evidence) x)<>jsonb_array_length(p_evidence) then raise exception using errcode='22023',message='Duplicate evidence alias';end if;
 for v_e in select value from jsonb_array_elements(p_evidence) loop
  if not exists(select 1 from jsonb_array_elements(r.members) m join public.source_studies s on s.source_id=(m->>'source_id')::uuid and s.user_id=r.user_id and s.status='succeeded' and s.source_version=(m->>'source_version')::integer,
   lateral jsonb_array_elements(s.note->'references') original where m->'source_id'=v_e->'source_id' and m->'source_version'=v_e->'source_version' and m->'title'=v_e->'title' and original=v_e->'passage') then raise exception using errcode='22023',message='Unknown original source passage';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(r.members) m where not exists(select 1 from jsonb_array_elements(p_evidence) e where e->'source_id'=m->'source_id')) then raise exception using errcode='22023',message='Missing source evidence';end if;
 if jsonb_typeof(p_draft->'path'->'lessons') is distinct from 'array' or jsonb_array_length(p_draft->'path'->'lessons') not between 1 and 4 or jsonb_typeof(p_draft->'contributions') is distinct from 'array' or jsonb_array_length(p_draft->'contributions') not between 1 and 5 or jsonb_typeof(p_draft->'disagreements') is distinct from 'array' or jsonb_array_length(p_draft->'disagreements')>5 then raise exception using errcode='22023',message='Invalid revision';end if;
 for claim in select x from jsonb_array_elements((select coalesce(jsonb_agg(c),'[]') from jsonb_array_elements(p_draft->'path'->'lessons') lesson,
  lateral jsonb_array_elements(jsonb_build_array(lesson->'explanation',lesson->'check'->'worked_answer')||case when lesson->'example'->>'provenance'='source_backed' then jsonb_build_array(lesson->'example') else '[]'::jsonb end) c)||p_draft->'contributions'||p_draft->'disagreements') x loop
  if jsonb_typeof(claim->'citation_ids') is distinct from 'array' or jsonb_array_length(claim->'citation_ids') not between 1 and 10 then raise exception using errcode='22023',message='Missing revision citations';end if;
  for citation in select value from jsonb_array_elements(claim->'citation_ids') loop
   if not exists(select 1 from jsonb_array_elements(p_evidence) e where e->'id'=citation) then raise exception using errcode='22023',message='Unknown revision citation';end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_draft->'disagreements') disagreement where (select count(distinct e->>'source_id') from jsonb_array_elements(p_evidence) e where disagreement->'citation_ids' ? (e->>'id'))<2) then raise exception using errcode='22023',message='Disagreements require both source perspectives';end if;
 if r.goal is null and r.added_source_id is null and (p_draft->'path'->'title'<>n.content->'title' or p_draft->'path'->'outcomes'<>n.content->'outcomes') then raise exception using errcode='22023',message='Difficulty changed path direction';end if;
 if r.added_source_id is not null and not exists(select 1 from jsonb_array_elements(p_draft->'contributions') c,jsonb_array_elements(p_evidence) e where e->>'source_id'=r.added_source_id::text and c->'citation_ids' ? (e->>'id')) then raise exception using errcode='22023',message='Contribution must cite the added source';end if;
 select jsonb_agg((e->'passage')||jsonb_build_object('id',e->>'id') order by ord) into refs from jsonb_array_elements(p_evidence) with ordinality evidence(e,ord);
 if r.goal is not null and not exists(select 1 from jsonb_array_elements(p_draft->'path'->'lessons') lesson where lesson->'check'->>'kind'='apply' and not exists(select 1 from jsonb_array_elements(n.content->'lessons') old where old->'check'->>'question'=lesson->'check'->>'question')) then raise exception using errcode='22023',message='Goal branch requires a new application check';end if;
 target_path:=n.path_id;
 if r.goal is not null then
  if (select count(*) from public.learning_paths lp where lp.user_id=r.user_id and lp.original_source_id=p.original_source_id)>=20 then raise exception using errcode='54000',message='Learning path limit reached';end if;
  insert into public.learning_paths(user_id,source_id,original_source_id,source_title) values(r.user_id,p.source_id,p.original_source_id,p.source_title) returning id into target_path;
 end if;
 insert into public.learning_plans(path_id,request_id,choice_index,user_id,source_version,goal,difficulty,content,source_references,model,evidence,source_members,revision,base_plan_id,branch_of_plan_id)
 values(target_path,r.id,0,r.user_id,n.source_version,coalesce(r.goal,n.goal),r.difficulty,p_draft->'path',refs,p_model,p_evidence,r.members,p_draft-'path',n.id,case when r.goal is not null then n.id else n.branch_of_plan_id end);
 update public.learning_revisions set status='ready',lease_token=null,lease_until=null where id=r.id;
 return true;
end;$$;
create or replace function public.confirm_learning_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;p public.learning_paths;s public.sources;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 perform public.learning_lock_members(n.user_id,n.source_members);
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into s from public.sources where id=p.source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid() for update;
 if not public.learning_plan_current(n.id) or n.confirmed_at is null and n.base_plan_id is not null and ((exists(select 1 from public.learning_plans b where b.id=n.base_plan_id and b.path_id=n.path_id) and p.active_plan_id is distinct from n.base_plan_id) or (not exists(select 1 from public.learning_plans b where b.id=n.base_plan_id and b.path_id=n.path_id) and not exists(select 1 from public.learning_plans b join public.learning_paths bp on bp.id=b.path_id and bp.user_id=n.user_id where b.id=n.base_plan_id and b.user_id=n.user_id and bp.active_plan_id=b.id and public.learning_plan_current(b.id)))) then
  raise exception using errcode='40001',message='Plan evidence changed or another revision was confirmed';end if;
 update public.learning_plans set confirmed_at=coalesce(confirmed_at,now()) where id=n.id;
 update public.learning_paths set active_plan_id=n.id where id=p.id;
 insert into public.learning_places(user_id,original_source_id,plan_id,lesson_index) values(n.user_id,p.original_source_id,n.id,0)
 on conflict(user_id,original_source_id) do update set plan_id=excluded.plan_id,lesson_index=0;
 return public.get_source_learning(p.original_source_id);
end;$$;
create or replace function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;plans jsonb;
begin
 result:=public.get_source_learning_v1(p_source_id);
 select coalesce(jsonb_agg(item||jsonb_build_object('branch_of_plan_id',n.branch_of_plan_id,'evidence',n.evidence,'source_members',n.source_members,'revision',n.revision,'base_plan_id',n.base_plan_id,'needs_review',not public.learning_plan_current(n.id)) order by n.created_at,n.id),'[]') into plans
 from jsonb_array_elements(result->'plans') item join public.learning_plans n on n.id=(item->>'id')::uuid and n.user_id=auth.uid();
 return result||jsonb_build_object('plans',plans,'selected_plan_id',(select plan_id from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),'selected_lesson_index',coalesce((select lesson_index from public.learning_places where user_id=auth.uid() and original_source_id=p_source_id),0));
end;$$;

revoke execute on function public.request_learning_revision(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.request_learning_revision(uuid,uuid,uuid,integer,text,text) to authenticated;
create function public.get_learning_graph() returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total integer;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='History not found';end if;
 select count(distinct p.original_source_id) into total from public.learning_paths p join public.learning_plans n on n.path_id=p.id and n.user_id=p.user_id where p.user_id=auth.uid() and n.confirmed_at is not null;
 with roots as (
  select p.original_source_id,max(p.created_at) created_at from public.learning_paths p join public.learning_plans n on n.path_id=p.id and n.user_id=p.user_id
  where p.user_id=auth.uid() and n.confirmed_at is not null group by p.original_source_id order by max(p.created_at) desc,p.original_source_id limit 200
 ), plans as (
  select n.*,p.original_source_id,p.source_title from public.learning_plans n join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  where n.user_id=auth.uid() and n.confirmed_at is not null and p.original_source_id in(select original_source_id from roots)
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'source_id',r.original_source_id,'source_available',exists(select 1 from public.sources s where s.id=r.original_source_id and s.user_id=auth.uid()),'title',(select source_title from plans where original_source_id=r.original_source_id order by created_at desc,id limit 1),
 'source_ids',(select jsonb_agg(id order by id) from (select r.original_source_id::text id union select m->>'source_id' from plans n,lateral jsonb_array_elements(n.source_members) m where n.original_source_id=r.original_source_id) ids),
 'path_count',(select count(distinct path_id) from plans where original_source_id=r.original_source_id),
 'studied_lessons',(select count(*) from public.learning_activities a join plans n on n.id=a.plan_id where a.user_id=auth.uid() and a.kind='read' and n.original_source_id=r.original_source_id),
 'practice_attempts',(select count(*) from public.learning_attempts a join plans n on n.id=a.plan_id where a.user_id=auth.uid() and n.original_source_id=r.original_source_id),
 'provisional_checks',(select count(*) from public.learning_attempts a join plans n on n.id=a.plan_id where a.user_id=auth.uid() and a.status='needs_review' and n.original_source_id=r.original_source_id),
 'flagged_plans',(select count(*) from plans n where n.original_source_id=r.original_source_id and not public.learning_plan_current(n.id))
 ) order by r.created_at desc,r.original_source_id),'[]') into items from roots r;
 return jsonb_build_object('user_id',auth.uid(),'collections',items,'partial',total>200);
end;$$;
revoke execute on function public.get_learning_graph() from public,anon,authenticated;
grant execute on function public.get_learning_graph() to authenticated;
commit;
