-- One-source teaching. Captures and notes are unchanged; history is append-only.
begin;

create table public.learning_paths (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid references public.sources(id) on delete set null,
 original_source_id uuid not null,
 source_title text not null,
 active_plan_id uuid,
 created_at timestamptz not null default now()
);
create table public.learning_previews (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_id uuid not null references public.sources(id) on delete cascade,
 source_version integer not null check(source_version between 1 and 20),
 goal text not null check(char_length(goal)<=500),
 difficulty text not null check(difficulty in ('foundation','intermediate','advanced')),
 path_id uuid references public.learning_paths(id),
 status text not null check(status in ('processing','ready','failed')),
 lease_token uuid,
 lease_until timestamptz,
 attempts integer not null default 1 check(attempts between 1 and 3),
 created_at timestamptz not null default now()
);
create table public.learning_plans (
 id uuid primary key default gen_random_uuid(),
 path_id uuid not null references public.learning_paths(id) on delete cascade,
 request_id uuid not null,
 choice_index integer not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_version integer not null check(source_version between 1 and 20),
 goal text not null check(char_length(goal) between 1 and 500),
 difficulty text not null check(difficulty in ('foundation','intermediate','advanced')),
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=65536),
 source_references jsonb not null check(jsonb_typeof(source_references)='array' and jsonb_array_length(source_references) between 0 and 100),
 model text not null check(model in ('gpt-6-luna','gpt-6.1-sol')),
 policy_version text not null default 'learning_v1' check(policy_version='learning_v1'),
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(request_id,choice_index)
);
alter table public.learning_paths add constraint learning_active_plan foreign key(active_plan_id) references public.learning_plans(id);
create table public.learning_attempts (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null references public.learning_plans(id) on delete cascade,
 lesson_index integer not null check(lesson_index between 0 and 3),
 response text not null check(char_length(btrim(response)) between 1 and 5000),
 difficulty text not null check(difficulty in ('foundation','intermediate','advanced')),
 status text not null default 'pending' check(status in ('pending','needs_review','failed')),
 feedback jsonb check(feedback is null or jsonb_typeof(feedback)='object' and octet_length(feedback::text)<=16384),
 lease_token uuid,
 lease_until timestamptz,
 evaluations integer not null default 0 check(evaluations between 0 and 3),
 created_at timestamptz not null default now()
);
create table public.learning_activities (
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null references public.learning_plans(id) on delete cascade,
 lesson_index integer not null check(lesson_index between 0 and 3),
 kind text not null check(kind in ('read','hint','reveal','background_opened')),
 created_at timestamptz not null default now(),
 primary key(plan_id,lesson_index,kind)
);
create index learning_paths_source on public.learning_paths(user_id,original_source_id);
create index learning_plans_path on public.learning_plans(path_id,created_at);
create index learning_attempts_plan on public.learning_attempts(plan_id,created_at);
alter table public.learning_paths enable row level security;
alter table public.learning_previews enable row level security;
alter table public.learning_plans enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_activities enable row level security;
revoke all on public.learning_paths,public.learning_previews,public.learning_plans,public.learning_attempts,public.learning_activities from public,anon,authenticated;
grant select on public.learning_paths,public.learning_plans,public.learning_attempts,public.learning_activities to authenticated;
create policy learning_paths_owned on public.learning_paths for select to authenticated using(user_id=(select auth.uid()));
create policy learning_plans_owned on public.learning_plans for select to authenticated using(user_id=(select auth.uid()));
create policy learning_attempts_owned on public.learning_attempts for select to authenticated using(user_id=(select auth.uid()));
create policy learning_activities_owned on public.learning_activities for select to authenticated using(user_id=(select auth.uid()));

-- Preserve learner work after removal, but never resurrect deleted capture excerpts.
create function public.clear_removed_learning_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.source_id is not null and new.source_id is null then
  update public.learning_plans set source_references='[]'::jsonb where path_id=new.id;
 end if;
 return new;
end;$$;
revoke execute on function public.clear_removed_learning_evidence() from public,anon,authenticated;
create trigger learning_source_removed after update of source_id on public.learning_paths
 for each row execute function public.clear_removed_learning_evidence();

create function public.get_learning_history(p_offset integer default 0,p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb; total integer;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='History not found';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then
  raise exception using errcode='22023',message='Invalid history page';end if;
 select count(distinct original_source_id) into total from public.learning_paths where user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('source_id',original_source_id,'title',source_title,'source_available',source_id is not null) order by created_at desc,original_source_id),'[]'::jsonb) into items
 from (select distinct on(original_source_id) original_source_id,source_id,source_title,created_at from public.learning_paths where user_id=auth.uid() order by original_source_id,created_at desc) all_paths
 where original_source_id in (select original_source_id from public.learning_paths where user_id=auth.uid() group by original_source_id order by max(created_at) desc,original_source_id offset p_offset limit p_limit);
 return jsonb_build_object('user_id',auth.uid(),'collections',items,'next_offset',case when p_offset+p_limit<total then p_offset+p_limit else null end);
end;$$;
revoke execute on function public.get_learning_history(integer,integer) from public,anon,authenticated;
grant execute on function public.get_learning_history(integer,integer) to authenticated;

create function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.sources; plans jsonb; attempts jsonb; activities jsonb;
begin
 select * into s from public.sources where id=p_source_id and user_id=auth.uid();
 if not found and not exists(select 1 from public.learning_paths where original_source_id=p_source_id and user_id=auth.uid()) then
  raise exception using errcode='P0002',message='Source not found';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'path_id',n.path_id,'request_id',n.request_id,'source_id',p.source_id,'source_title',p.source_title,
  'source_version',n.source_version,'goal',n.goal,'difficulty',n.difficulty,'content',n.content,'references',n.source_references,
  'confirmed_at',n.confirmed_at,'active',coalesce(p.active_plan_id=n.id,false),'needs_review',s.id is null or n.source_version<>s.source_version,
  'model',n.model,'policy_version',n.policy_version,'created_at',n.created_at) order by n.created_at,n.id),'[]'::jsonb)
 into plans from public.learning_plans n join public.learning_paths p on p.id=n.path_id
 where p.original_source_id=p_source_id and p.user_id=auth.uid() and n.user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'plan_id',a.plan_id,'lesson_index',a.lesson_index,
  'response',a.response,'difficulty',a.difficulty,'status',a.status,'feedback',a.feedback,'created_at',a.created_at)
  order by a.created_at,a.id),'[]'::jsonb) into attempts
 from public.learning_attempts a join public.learning_plans n on n.id=a.plan_id join public.learning_paths p on p.id=n.path_id
 where p.original_source_id=p_source_id and a.user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('plan_id',a.plan_id,'lesson_index',a.lesson_index,'kind',a.kind)
  order by a.created_at),'[]'::jsonb) into activities
 from public.learning_activities a join public.learning_plans n on n.id=a.plan_id join public.learning_paths p on p.id=n.path_id
 where p.original_source_id=p_source_id and a.user_id=auth.uid();
 return jsonb_build_object('user_id',auth.uid(),'source_id',p_source_id,'plans',plans,'attempts',attempts,'activities',activities);
end;$$;

create function public.request_learning_preview(p_source_id uuid,p_source_version integer,p_request_id uuid,p_goal text,p_difficulty text,p_path_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sources; n public.source_studies; r public.learning_previews; token uuid; direction jsonb;
begin
 select * into s from public.sources where id=p_source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source not found';end if;
 if s.source_version<>p_source_version then raise exception using errcode='40001',message='Source changed';end if;
 select * into n from public.source_studies where source_id=s.id and user_id=auth.uid() and status='succeeded' and source_version=s.source_version;
 if not found then raise exception using errcode='40001',message='Wait for current study note';end if;
 if p_goal is null or char_length(p_goal)>500 or p_difficulty is null or p_difficulty not in ('foundation','intermediate','advanced') then
  raise exception using errcode='22023',message='Invalid learning preferences';end if;
 if p_path_id is not null and not exists(select 1 from public.learning_paths p join public.learning_plans lp on lp.id=p.active_plan_id where p.id=p_path_id and p.source_id=s.id and p.user_id=auth.uid() and lp.goal=p_goal and lp.source_version=s.source_version) then
  raise exception using errcode='P0002',message='Path not found';end if;
 if p_path_id is not null then select lp.content into direction from public.learning_paths p join public.learning_plans lp on lp.id=p.active_plan_id where p.id=p_path_id and p.user_id=auth.uid();end if;
 select * into r from public.learning_previews where id=p_request_id;
 if found then
  if r.user_id<>auth.uid() or r.source_id<>s.id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.source_version<>p_source_version or r.goal<>p_goal or r.difficulty<>p_difficulty or r.path_id is distinct from p_path_id then
   raise exception using errcode='40001',message='Request changed';end if;
  if r.status='ready' then token:=null;
  elsif r.status='processing' and r.lease_until>now() then raise exception using errcode='55P03',message='Preview is still generating';
  elsif r.attempts>=3 then raise exception using errcode='54000',message='Preview retry limit reached';
  else token:=gen_random_uuid();update public.learning_previews set status='processing',lease_token=token,lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=r.id;
  end if;
 else
  if exists(select 1 from public.learning_previews where user_id=auth.uid() and source_id=s.id and status='processing' and lease_until>now()) then
   raise exception using errcode='55P03',message='Another preview is generating';end if;
  if (select count(*) from public.learning_previews where user_id=auth.uid() and source_id=s.id and created_at>now()-interval '1 hour')>=10 then
   raise exception using errcode='54000',message='Too many previews';end if;
  token:=gen_random_uuid();
  insert into public.learning_previews(id,user_id,source_id,source_version,goal,difficulty,path_id,status,lease_token,lease_until)
  values(p_request_id,auth.uid(),s.id,s.source_version,p_goal,p_difficulty,p_path_id,'processing',token,now()+interval '120 seconds');
 end if;
 return jsonb_build_object('user_id',auth.uid(),'request_id',p_request_id,'source',to_jsonb(s),'note',n.note,'lease_token',token,'path_direction',direction);
end;$$;

create function public.finish_learning_preview(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_goal text,p_references jsonb,p_model text)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.learning_previews; s public.sources; n public.source_studies; item jsonb; lesson jsonb; claim jsonb; ref jsonb; pid uuid; idx integer:=0;
begin
 -- Source locks precede request/plan locks, matching source refresh/delete.
 select * into r from public.learning_previews where id=p_request_id and lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Request not found';end if;
 select * into s from public.sources where id=r.source_id and user_id=r.user_id for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 select * into r from public.learning_previews where id=p_request_id for update;
 if r.status<>'processing' or r.lease_token is distinct from p_lease_token or r.lease_until<=now() or s.source_version<>r.source_version then
  raise exception using errcode='40001',message='Expired or stale generation';end if;
 if p_draft is null then
  update public.learning_previews set status='failed',lease_token=null,lease_until=null where id=r.id;
  return true;
 end if;
 select * into n from public.source_studies where source_id=s.id and user_id=r.user_id and status='succeeded' and source_version=s.source_version;
 if not found then raise exception using errcode='40001',message='Study changed';end if;
 if jsonb_typeof(p_draft->'paths') is distinct from 'array' or jsonb_array_length(p_draft->'paths') not between 1 and 3 or
  (r.path_id is not null and jsonb_array_length(p_draft->'paths')<>1) or
  p_goal is null or char_length(btrim(p_goal)) not between 1 and 500 or p_model is null or p_model not in ('gpt-6-luna','gpt-6.1-sol') or
  jsonb_typeof(p_references) is distinct from 'array' or jsonb_array_length(p_references) not between 1 and 100 then
  raise exception using errcode='22023',message='Invalid teaching draft';end if;
 if (select count(*) from public.learning_plans lp join public.learning_paths p on p.id=lp.path_id where p.source_id=s.id and p.user_id=r.user_id)+jsonb_array_length(p_draft->'paths')>40 then
  raise exception using errcode='54000',message='Learning plan limit reached';end if;
 for ref in select value from jsonb_array_elements(p_references) loop
  if not exists(select 1 from jsonb_array_elements(n.note->'references') original where original=ref) then
   raise exception using errcode='22023',message='Unknown source reference';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_draft->'paths') loop
  if jsonb_typeof(item->'lessons') is distinct from 'array' or jsonb_array_length(item->'lessons') not between 1 and 4 then
   raise exception using errcode='22023',message='Invalid lessons';end if;
  for lesson in select value from jsonb_array_elements(item->'lessons') loop
   if jsonb_typeof(lesson->'check'->'criteria') is distinct from 'array' or jsonb_array_length(lesson->'check'->'criteria') not between 1 and 5 then
    raise exception using errcode='22023',message='Invalid check';end if;
   for claim in select value from jsonb_array_elements(jsonb_build_array(lesson->'explanation',lesson->'check'->'worked_answer')) loop
    if jsonb_typeof(claim->'citation_ids') is distinct from 'array' or jsonb_array_length(claim->'citation_ids') not between 1 and 10 then
     raise exception using errcode='22023',message='Missing teaching citation';end if;
    for ref in select value from jsonb_array_elements(claim->'citation_ids') loop
     if not exists(select 1 from jsonb_array_elements(p_references) original where original->'id'=ref) then
      raise exception using errcode='22023',message='Unknown teaching citation';end if;
    end loop;
   end loop;
  end loop;
  if r.path_id is not null and not exists(select 1 from public.learning_paths p join public.learning_plans lp on lp.id=p.active_plan_id where p.id=r.path_id and p.user_id=r.user_id and lp.content->'title'=item->'title' and lp.content->'outcomes'=item->'outcomes') then
   raise exception using errcode='22023',message='Difficulty changed path direction';end if;
  pid:=r.path_id;
  if pid is null then insert into public.learning_paths(user_id,source_id,original_source_id,source_title) values(r.user_id,s.id,s.id,s.title) returning id into pid;end if;
  insert into public.learning_plans(path_id,request_id,choice_index,user_id,source_version,goal,difficulty,content,source_references,model)
  values(pid,r.id,idx,r.user_id,s.source_version,p_goal,r.difficulty,item,p_references,p_model);
  idx:=idx+1;
 end loop;
 update public.learning_previews set status='ready',lease_token=null,lease_until=null where id=r.id;
 return true;
end;$$;

create function public.confirm_learning_plan(p_plan_id uuid) returns jsonb
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

-- A common authenticated, current-version fence for attempt/activity mutations.
create function public.learning_plan_context(p_plan_id uuid) returns jsonb
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

create function public.submit_learning_attempt(p_plan_id uuid,p_request_id uuid,p_lesson_index integer,p_response text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; a public.learning_attempts;
begin
 c:=public.learning_plan_context(p_plan_id);
 if p_lesson_index is null or p_lesson_index<0 or p_lesson_index>=jsonb_array_length(c->'content'->'lessons') or p_response is null or char_length(btrim(p_response)) not between 1 and 5000 then
  raise exception using errcode='22023',message='Invalid practice attempt';end if;
 select * into a from public.learning_attempts where id=p_request_id;
 if found then
  if a.user_id<>auth.uid() then raise exception using errcode='P0002',message='Attempt not found';end if;
  if a.plan_id<>p_plan_id or a.lesson_index<>p_lesson_index or a.response<>p_response then raise exception using errcode='40001',message='Submission changed';end if;
 else
  if (select count(*) from public.learning_attempts la join public.learning_plans lp on lp.id=la.plan_id join public.learning_paths p on p.id=lp.path_id where p.source_id=(c->>'source_id')::uuid and la.user_id=auth.uid())>=1000 then
   raise exception using errcode='54000',message='Attempt history limit reached';end if;
  insert into public.learning_attempts(id,user_id,plan_id,lesson_index,response,difficulty)
  values(p_request_id,auth.uid(),p_plan_id,p_lesson_index,p_response,c->>'difficulty');
 end if;
 return public.get_source_learning((c->>'source_id')::uuid);
end;$$;

create function public.claim_learning_feedback(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.learning_attempts; c jsonb; token uuid;
begin
 select * into a from public.learning_attempts where id=p_attempt_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Attempt not found';end if;
 c:=public.learning_plan_context(a.plan_id);
 select * into a from public.learning_attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if a.status='needs_review' then token:=null;
 elsif a.lease_until>now() then raise exception using errcode='55P03',message='Feedback is still generating';
 elsif a.evaluations>=3 then raise exception using errcode='54000',message='Feedback retry limit reached';
 else token:=gen_random_uuid();
  update public.learning_attempts set status='pending',lease_token=token,lease_until=now()+interval '120 seconds',evaluations=evaluations+1 where id=a.id;
 end if;
 return jsonb_build_object('user_id',auth.uid(),'source_id',c->'source_id','attempt_id',a.id,'plan_id',a.plan_id,'lesson_index',a.lesson_index,'response',a.response,'lease_token',token);
end;$$;

create function public.finish_learning_feedback(p_attempt_id uuid,p_lease_token uuid,p_feedback jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare a public.learning_attempts; n public.learning_plans; p public.learning_paths; s public.sources;
begin
 select * into a from public.learning_attempts where id=p_attempt_id and lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Attempt not found';end if;
 select * into n from public.learning_plans where id=a.plan_id and user_id=a.user_id;
 select * into p from public.learning_paths where id=n.path_id and user_id=a.user_id;
 select * into s from public.sources where id=p.source_id and user_id=a.user_id for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 if n.source_version<>s.source_version or n.confirmed_at is null then raise exception using errcode='40001',message='Plan evidence changed';end if;
 select * into a from public.learning_attempts where id=p_attempt_id for update;
 if a.lease_token is distinct from p_lease_token or a.lease_until<=now() or a.status<>'pending' then
  raise exception using errcode='40001',message='Feedback expired';end if;
 update public.learning_attempts set feedback=p_feedback,status=case when p_feedback is null then 'failed' else 'needs_review' end,lease_token=null,lease_until=null where id=a.id;
 return true;
end;$$;

create function public.record_learning_activity(p_plan_id uuid,p_lesson_index integer,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; count integer;
begin
 c:=public.learning_plan_context(p_plan_id);
 count:=case when p_kind='background_opened' then jsonb_array_length(c->'content'->'background') else jsonb_array_length(c->'content'->'lessons') end;
 if p_kind is null or p_kind not in ('read','hint','reveal','background_opened') or p_lesson_index is null or p_lesson_index<0 or p_lesson_index>=count then
  raise exception using errcode='22023',message='Invalid activity';end if;
 insert into public.learning_activities(user_id,plan_id,lesson_index,kind) values(auth.uid(),p_plan_id,p_lesson_index,p_kind) on conflict do nothing;
 return public.get_source_learning((c->>'source_id')::uuid);
end;$$;

revoke execute on function public.get_source_learning(uuid),public.request_learning_preview(uuid,integer,uuid,text,text,uuid),public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text),public.confirm_learning_plan(uuid),public.learning_plan_context(uuid),public.submit_learning_attempt(uuid,uuid,integer,text),public.claim_learning_feedback(uuid),public.finish_learning_feedback(uuid,uuid,jsonb),public.record_learning_activity(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.get_source_learning(uuid),public.request_learning_preview(uuid,integer,uuid,text,text,uuid),public.confirm_learning_plan(uuid),public.submit_learning_attempt(uuid,uuid,integer,text),public.claim_learning_feedback(uuid),public.record_learning_activity(uuid,integer,text) to authenticated;
grant execute on function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text),public.finish_learning_feedback(uuid,uuid,jsonb) to service_role;
commit;
