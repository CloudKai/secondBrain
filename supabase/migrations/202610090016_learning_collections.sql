-- Confirmed multi-source teaching revisions; existing plans/attempts are retained.
begin;
alter table public.learning_plans add column evidence jsonb not null default '[]' check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)<=100);
alter table public.learning_plans add column source_members jsonb not null default '[]' check(jsonb_typeof(source_members)='array' and jsonb_array_length(source_members)<=8);
alter table public.learning_plans add column revision jsonb;
alter table public.learning_plans add column base_plan_id uuid references public.learning_plans(id);

create function public.learning_confirmed_topics(p_user uuid,p_source uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(t order by t->>'id'),'[]') from public.sources s
 join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id and n.source_version=s.source_version and n.status='succeeded'
 join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id and m.status='succeeded',lateral jsonb_array_elements(m.analysis->'topics') t
 where s.id=p_source and s.user_id=p_user and t->>'uncertain'='false'
 and not exists(select 1 from public.source_topic_overrides o where o.source_id=s.id and o.user_id=p_user and o.needs_review)
$$;
revoke execute on function public.learning_confirmed_topics(uuid,uuid) from public,anon,authenticated;

create function public.get_learning_candidates(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.learning_paths;n public.learning_plans;items jsonb;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 perform public.learning_plan_context(n.id);
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('source_id',id,'source_version',source_version,'title',title,'shared_topics',topics) order by captured_at desc,id),'[]') into items from (
  select s.id,s.source_version,s.title,s.captured_at,(select jsonb_agg(title order by title) from
   (select distinct left(a->>'title',500) title from jsonb_array_elements(case when jsonb_array_length(n.source_members)=0 then jsonb_build_array(jsonb_build_object('source_id',p.source_id)) else n.source_members end) existing,
    jsonb_array_elements(public.learning_confirmed_topics(auth.uid(),(existing->>'source_id')::uuid)) a,
    jsonb_array_elements(public.learning_confirmed_topics(auth.uid(),s.id)) b where a->>'id'=b->>'id' limit 10) shared) topics
  from public.sources s where s.user_id=auth.uid() and s.id<>p.source_id
  and not exists(select 1 from jsonb_array_elements(n.source_members) m where m->>'source_id'=s.id::text)
  order by s.captured_at desc,s.id limit 200
 ) candidates where topics is not null;
 return jsonb_build_object('user_id',auth.uid(),'source_id',p.original_source_id,'plan_id',n.id,'candidates',items);
end;$$;
revoke execute on function public.get_learning_candidates(uuid) from public,anon,authenticated;
grant execute on function public.get_learning_candidates(uuid) to authenticated;

create table public.learning_revisions (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 base_plan_id uuid not null references public.learning_plans(id),
 added_source_id uuid,added_source_version integer,
 difficulty text not null check(difficulty in ('foundation','intermediate','advanced')),
 members jsonb not null check(jsonb_typeof(members)='array' and jsonb_array_length(members) between 2 and 8),
 status text not null check(status in ('processing','ready','failed')),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 1 check(attempts between 1 and 3),
 created_at timestamptz not null default now()
);
alter table public.learning_revisions enable row level security;
revoke all on public.learning_revisions from public,anon,authenticated;

create function public.learning_members_current(p_user uuid,p_members jsonb) returns boolean
language sql stable set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(p_members) m where not exists(
  select 1 from public.sources s where s.id::text=m->>'source_id' and s.user_id=p_user
  and s.source_version=(m->>'source_version')::integer
  and md5(public.learning_confirmed_topics(p_user,s.id)::text)=m->>'topic_fingerprint'))
$$;
create function public.learning_lock_members(p_user uuid,p_members jsonb) returns void
language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 -- Stable source order first, then metadata, then preview/path/attempt rows.
 perform 1 from public.sources s where s.user_id=p_user and exists(select 1 from jsonb_array_elements(p_members) m where m->>'source_id'=s.id::text) order by s.id for update;
 perform 1 from public.source_topic_maps s where s.user_id=p_user and exists(select 1 from jsonb_array_elements(p_members) m where m->>'source_id'=s.source_id::text) order by s.source_id for share;
 perform 1 from public.source_topic_overrides s where s.user_id=p_user and exists(select 1 from jsonb_array_elements(p_members) m where m->>'source_id'=s.source_id::text) order by s.source_id for share;
end;$$;
create function public.learning_plan_current(p_plan uuid) returns boolean
language sql stable set search_path='' as $$
 select coalesce((select s.source_version=n.source_version and public.learning_members_current(n.user_id,n.source_members)
 from public.learning_plans n join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
 join public.sources s on s.id=p.source_id and s.user_id=n.user_id where n.id=p_plan),false)
$$;
revoke execute on function public.learning_members_current(uuid,jsonb),public.learning_lock_members(uuid,jsonb),public.learning_plan_current(uuid) from public,anon,authenticated;

alter function public.get_source_learning(uuid) rename to get_source_learning_v1;
revoke execute on function public.get_source_learning_v1(uuid) from public,anon,authenticated;
create function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;plans jsonb;
begin
 result:=public.get_source_learning_v1(p_source_id);
 select coalesce(jsonb_agg(item||jsonb_build_object('evidence',n.evidence,'source_members',n.source_members,'revision',n.revision,'base_plan_id',n.base_plan_id,'needs_review',not public.learning_plan_current(n.id)) order by n.created_at,n.id),'[]') into plans
 from jsonb_array_elements(result->'plans') item join public.learning_plans n on n.id=(item->>'id')::uuid and n.user_id=auth.uid();
 return result||jsonb_build_object('plans',plans);
end;$$;
revoke execute on function public.get_source_learning(uuid) from public,anon,authenticated;
grant execute on function public.get_source_learning(uuid) to authenticated;

create or replace function public.learning_plan_context(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;p public.learning_paths;s public.sources;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 perform public.learning_lock_members(n.user_id,n.source_members);
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into s from public.sources where id=p.source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 if not public.learning_plan_current(n.id) or n.confirmed_at is null then raise exception using errcode='40001',message='Plan not confirmed or evidence changed';end if;
 return jsonb_build_object('source_id',s.id,'content',n.content,'difficulty',n.difficulty);
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
 if not public.learning_plan_current(n.id) or n.confirmed_at is null and n.base_plan_id is not null and p.active_plan_id<>n.base_plan_id then
  raise exception using errcode='40001',message='Plan evidence changed or another revision was confirmed';end if;
 update public.learning_plans set confirmed_at=coalesce(confirmed_at,now()) where id=n.id;
 update public.learning_paths set active_plan_id=n.id where id=p.id;
 return public.get_source_learning(p.original_source_id);
end;$$;

alter function public.finish_learning_feedback(uuid,uuid,jsonb) rename to finish_learning_feedback_v1;
revoke execute on function public.finish_learning_feedback_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.finish_learning_feedback(p_attempt_id uuid,p_lease_token uuid,p_feedback jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;
begin
 select lp.* into n from public.learning_attempts a join public.learning_plans lp on lp.id=a.plan_id and lp.user_id=a.user_id where a.id=p_attempt_id and a.lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Attempt not found';end if;
 if jsonb_array_length(n.source_members)=0 then return public.finish_learning_feedback_v1(p_attempt_id,p_lease_token,p_feedback);end if;
 perform public.learning_lock_members(n.user_id,n.source_members);
 if not public.learning_plan_current(n.id) then raise exception using errcode='40001',message='Plan evidence changed';end if;
 return public.finish_learning_feedback_v1(p_attempt_id,p_lease_token,p_feedback);
end;$$;
revoke execute on function public.finish_learning_feedback(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_learning_feedback(uuid,uuid,jsonb) to service_role;

create function public.request_learning_revision(p_plan_id uuid,p_request_id uuid,p_source_id uuid,p_source_version integer,p_difficulty text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;p public.learning_paths;r public.learning_revisions;members jsonb;inputs jsonb;token uuid;ids jsonb;
begin
 select * into n from public.learning_plans where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Plan not found';end if;
 select * into p from public.learning_paths where id=n.path_id and user_id=auth.uid();
 select * into r from public.learning_revisions where id=p_request_id;
 if found then
  if r.user_id<>auth.uid() or r.base_plan_id<>n.id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.added_source_id is distinct from p_source_id or r.added_source_version is distinct from p_source_version or r.difficulty<>coalesce(p_difficulty,n.difficulty) then raise exception using errcode='40001',message='Request changed';end if;
  members:=r.members;
 else
  if n.confirmed_at is null or p.active_plan_id is distinct from n.id or not public.learning_plan_current(n.id) then raise exception using errcode='40001',message='Plan evidence changed';end if;
  if p_source_id is null and (p_source_version is not null or p_difficulty is null or p_difficulty not in ('foundation','intermediate','advanced') or jsonb_array_length(n.source_members)<2) or p_source_id is not null and (p_source_version is null or p_difficulty is not null) then raise exception using errcode='22023',message='Choose source contribution or collection difficulty';end if;
  if p_source_id is not null and not exists(select 1 from jsonb_array_elements(public.get_learning_candidates(n.id)->'candidates') candidate where candidate->>'source_id'=p_source_id::text and (candidate->>'source_version')::integer=p_source_version) then raise exception using errcode='P0002',message='Related source not found';end if;
  ids:=case when jsonb_array_length(n.source_members)=0 then jsonb_build_array(p.source_id) else (select jsonb_agg(m->'source_id') from jsonb_array_elements(n.source_members) m) end||case when p_source_id is null then '[]'::jsonb else jsonb_build_array(p_source_id) end;
  if jsonb_array_length(ids)>8 then raise exception using errcode='54000',message='Collection source limit reached';end if;
  select jsonb_agg(jsonb_build_object('source_id',s.id,'source_version',s.source_version,'title',s.title,'topic_fingerprint',md5(public.learning_confirmed_topics(auth.uid(),s.id)::text)) order by ord) into members
  from jsonb_array_elements_text(ids) with ordinality member(id,ord) join public.sources s on s.id=member.id::uuid and s.user_id=auth.uid();
 end if;
 perform public.learning_lock_members(auth.uid(),members);
 if not public.learning_members_current(auth.uid(),members) then raise exception using errcode='40001',message='Source evidence changed';end if;
 if coalesce(r.status,'')<>'ready' and not exists(select 1 from public.learning_paths lp where lp.id=n.path_id and lp.user_id=auth.uid() and lp.active_plan_id=n.id) then raise exception using errcode='40001',message='Another plan was confirmed';end if;
 select * into r from public.learning_revisions where id=p_request_id for update;
 if found then
  if r.user_id<>auth.uid() or r.base_plan_id<>n.id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.added_source_id is distinct from p_source_id or r.added_source_version is distinct from p_source_version or r.difficulty<>coalesce(p_difficulty,n.difficulty) or r.members<>members then raise exception using errcode='40001',message='Request changed';end if;
  if r.status='ready' then token:=null;
  elsif r.status='processing' and r.lease_until>now() then raise exception using errcode='55P03',message='Revision is still generating';
  elsif r.attempts>=3 then raise exception using errcode='54000',message='Revision retry limit reached';
  else token:=gen_random_uuid();update public.learning_revisions set status='processing',lease_token=token,lease_until=now()+interval '120 seconds',attempts=attempts+1 where id=r.id;end if;
 else
  if exists(select 1 from public.learning_revisions lr join public.learning_plans lp on lp.id=lr.base_plan_id where lr.user_id=auth.uid() and lp.path_id=n.path_id and lr.status='processing' and lr.lease_until>now()) then raise exception using errcode='55P03',message='Another revision is still generating';end if;
  if (select count(*) from public.learning_revisions where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception using errcode='54000',message='Revision generation limit';end if;
  token:=gen_random_uuid();insert into public.learning_revisions(id,user_id,base_plan_id,added_source_id,added_source_version,difficulty,members,status,lease_token,lease_until) values(p_request_id,auth.uid(),n.id,p_source_id,p_source_version,coalesce(p_difficulty,n.difficulty),members,'processing',token,now()+interval '120 seconds');
 end if;
 select jsonb_agg(jsonb_build_object('source',to_jsonb(s),'note',study.note) order by ord) into inputs from jsonb_array_elements(members) with ordinality member(m,ord)
 join public.sources s on s.id=(m->>'source_id')::uuid and s.user_id=auth.uid()
 join public.source_studies study on study.source_id=s.id and study.user_id=s.user_id and study.source_version=s.source_version and study.status='succeeded';
 if jsonb_array_length(inputs) is distinct from jsonb_array_length(members) then raise exception using errcode='40001',message='Wait for source notes';end if;
 return jsonb_build_object('user_id',auth.uid(),'source_id',p.original_source_id,'request_id',p_request_id,'lease_token',token,'sources',inputs,'mode',case when p_source_id is null then 'difficulty' else 'add_source' end,'difficulty',coalesce(p_difficulty,n.difficulty),'base_plan',(select plan from jsonb_array_elements(public.get_source_learning(p.original_source_id)->'plans') plan where plan->>'id'=n.id::text));
end;$$;

create function public.finish_learning_revision(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_evidence jsonb,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.learning_revisions;n public.learning_plans;p public.learning_paths;v_e jsonb;refs jsonb;claim jsonb;citation jsonb;
begin
 select * into r from public.learning_revisions where id=p_request_id and lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Request not found';end if;
 perform public.learning_lock_members(r.user_id,r.members);
 select * into r from public.learning_revisions where id=p_request_id for update;
 select * into n from public.learning_plans where id=r.base_plan_id and user_id=r.user_id;
 select * into p from public.learning_paths where id=n.path_id and user_id=r.user_id for update;
 if r.status<>'processing' or r.lease_token is distinct from p_lease_token or r.lease_until<=now() or p.active_plan_id is distinct from n.id or not public.learning_members_current(r.user_id,r.members) then raise exception using errcode='40001',message='Expired or changed revision';end if;
 if p_draft is null then update public.learning_revisions set status='failed',lease_token=null,lease_until=null where id=r.id;return true;end if;
 if p_model is null or p_model not in ('gpt-6-luna','gpt-6.1-sol') or jsonb_typeof(p_evidence) is distinct from 'array' or jsonb_array_length(p_evidence) not between 2 and 100 or octet_length(p_evidence::text)>262144 then raise exception using errcode='22023',message='Invalid revision evidence';end if;
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
 if r.added_source_id is null and (p_draft->'path'->'title'<>n.content->'title' or p_draft->'path'->'outcomes'<>n.content->'outcomes') then raise exception using errcode='22023',message='Difficulty changed path direction';end if;
 if r.added_source_id is not null and not exists(select 1 from jsonb_array_elements(p_draft->'contributions') c,jsonb_array_elements(p_evidence) e where e->>'source_id'=r.added_source_id::text and c->'citation_ids' ? (e->>'id')) then raise exception using errcode='22023',message='Contribution must cite the added source';end if;
 select jsonb_agg((e->'passage')||jsonb_build_object('id',e->>'id') order by ord) into refs from jsonb_array_elements(p_evidence) with ordinality evidence(e,ord);
 insert into public.learning_plans(path_id,request_id,choice_index,user_id,source_version,goal,difficulty,content,source_references,model,evidence,source_members,revision,base_plan_id)
 values(n.path_id,r.id,0,r.user_id,n.source_version,n.goal,r.difficulty,p_draft->'path',refs,p_model,p_evidence,r.members,p_draft-'path',n.id);
 update public.learning_revisions set status='ready',lease_token=null,lease_until=null where id=r.id;
 return true;
end;$$;
revoke execute on function public.request_learning_revision(uuid,uuid,uuid,integer,text),public.finish_learning_revision(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.request_learning_revision(uuid,uuid,uuid,integer,text) to authenticated;
grant execute on function public.finish_learning_revision(uuid,uuid,jsonb,jsonb,text) to service_role;

create function public.clear_removed_collection_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.learning_plans set evidence='[]',source_references='[]' where user_id=old.user_id and exists(select 1 from jsonb_array_elements(source_members) member where member->>'source_id'=old.id::text);
 return old;
end;$$;
revoke execute on function public.clear_removed_collection_evidence() from public,anon,authenticated;
create trigger learning_collection_source_removed before delete on public.sources for each row execute function public.clear_removed_collection_evidence();

alter function public.request_learning_preview(uuid,integer,uuid,text,text,uuid) rename to request_learning_preview_v1;
revoke execute on function public.request_learning_preview_v1(uuid,integer,uuid,text,text,uuid) from public,anon,authenticated;
create function public.request_learning_preview(p_source_id uuid,p_source_version integer,p_request_id uuid,p_goal text,p_difficulty text,p_path_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_path_id is not null and exists(select 1 from public.learning_paths p join public.learning_plans n on n.id=p.active_plan_id where p.id=p_path_id and p.user_id=auth.uid() and jsonb_array_length(n.source_members)>0) then raise exception using errcode='40001',message='Use a collection difficulty preview to retain all sources';end if;
 return public.request_learning_preview_v1(p_source_id,p_source_version,p_request_id,p_goal,p_difficulty,p_path_id);
end;$$;
revoke execute on function public.request_learning_preview(uuid,integer,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.request_learning_preview(uuid,integer,uuid,text,text,uuid) to authenticated;

alter function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text) rename to finish_learning_preview_v1;
revoke execute on function public.finish_learning_preview_v1(uuid,uuid,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.finish_learning_preview(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_goal text,p_references jsonb,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.learning_previews;
begin
 select * into r from public.learning_previews where id=p_request_id and lease_token=p_lease_token;
 if not found then raise exception using errcode='P0002',message='Request not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.user_id::text,0));
 if p_draft is not null and r.path_id is not null and exists(select 1 from public.learning_paths p join public.learning_plans n on n.id=p.active_plan_id where p.id=r.path_id and p.user_id=r.user_id and jsonb_array_length(n.source_members)>0) then raise exception using errcode='40001',message='Learning collection evidence changed';end if;
 return public.finish_learning_preview_v1(p_request_id,p_lease_token,p_draft,p_goal,p_references,p_model);
end;$$;
revoke execute on function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text) to service_role;
commit;
