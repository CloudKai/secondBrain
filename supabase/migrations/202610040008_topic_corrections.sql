-- Learner metadata remains authoritative over automatic organization.
begin;
create table public.topic_rules (
 user_id uuid not null references auth.users(id) on delete cascade,
 topic_id uuid not null,
 target_id uuid,
 descriptor jsonb,
 title text check(title is null or (length(btrim(title)) between 1 and 100)),
 primary key(user_id,topic_id)
);
alter table public.topic_rules enable row level security;
revoke all on public.topic_rules from anon,authenticated;
grant select,insert,update,delete on public.topic_rules to service_role;

create table public.topic_connection_decisions (
 user_id uuid not null references auth.users(id) on delete cascade,
 source uuid not null,target uuid not null,
 state text not null check(state in ('accepted','rejected')),
 primary key(user_id,source,target),check(source<target)
);
alter table public.topic_connection_decisions enable row level security;
revoke all on public.topic_connection_decisions from anon,authenticated;
grant select on public.topic_connection_decisions to authenticated;
grant select,insert,update,delete on public.topic_connection_decisions to service_role;
create policy topic_decisions_read_own on public.topic_connection_decisions for select to authenticated using(user_id=(select auth.uid()));

create table public.source_topic_overrides (
 source_id uuid primary key,user_id uuid not null,
 analysis jsonb not null check(jsonb_typeof(analysis)='object' and octet_length(analysis::text)<=131072),
 foreign key(source_id,user_id) references public.sources(id,user_id) on delete cascade
);
alter table public.source_topic_overrides enable row level security;
revoke all on public.source_topic_overrides from anon,authenticated;
grant select,insert,update,delete on public.source_topic_overrides to service_role;
-- Preserve placement confirmations made before this slice.
insert into public.source_topic_overrides(source_id,user_id,analysis)
 select source_id,user_id,analysis from public.source_topic_maps m where m.status='succeeded' and
 exists(select 1 from jsonb_array_elements(m.analysis->'topics') t where t->>'placement_reason'='Placement confirmed by the learner.');

create function public.canonical_topic_id(p_user uuid,p_id uuid)
returns uuid language plpgsql stable set search_path='' as $$
declare v_id uuid:=p_id;v_next uuid;v_depth integer:=0;
begin
 loop
  select target_id into v_next from public.topic_rules where user_id=p_user and topic_id=v_id;
  if v_next is null then return v_id;end if;
  v_depth:=v_depth+1;if v_depth>64 then raise exception 'Invalid topic redirect';end if;
  v_id:=v_next;
 end loop;
end;
$$;
create function public.apply_topic_rules(p_user uuid,p_analysis jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare v_topics jsonb:='[]';v_topic jsonb;v_old jsonb;v_meta jsonb;v_title text;v_id uuid;v_relations jsonb;
begin
 for v_topic in select value from jsonb_array_elements(p_analysis->'topics') loop
  v_id:=public.canonical_topic_id(p_user,(v_topic->>'id')::uuid);
  if v_id::text<>v_topic->>'id' then
   select descriptor into v_meta from public.topic_rules where user_id=p_user and topic_id=(v_topic->>'id')::uuid;
   v_topic:=v_topic||coalesce(v_meta,'{}')||jsonb_build_object('id',v_id,'uncertain',false,'suggested_topic_id',null,'placement_reason','Topics merged by the learner.');
  elsif v_topic->>'suggested_topic_id' is not null then
   v_topic:=v_topic||jsonb_build_object('suggested_topic_id',public.canonical_topic_id(p_user,(v_topic->>'suggested_topic_id')::uuid));
  end if;
  select title into v_title from public.topic_rules where user_id=p_user and topic_id=v_id;
  if v_title is not null then
   v_topic:=v_topic||jsonb_build_object('aliases',(select coalesce(jsonb_agg(x),'[]') from (select distinct x from jsonb_array_elements((v_topic->'aliases')||jsonb_build_array(v_topic->>'title')) x where x<>to_jsonb(v_title) order by x limit 6) aliases),'title',v_title);
  end if;
  select x into v_old from jsonb_array_elements(v_topics) x where x->>'id'=v_id::text;
  if v_old is not null then
   v_topic:=v_old||jsonb_build_object('role',case when v_old->>'role'='main' or v_topic->>'role'='main' then 'main' else 'supporting' end,
    'citation_ids',(select jsonb_agg(c) from (select distinct c from jsonb_array_elements((v_old->'citation_ids')||(v_topic->'citation_ids')) c order by c limit 10) refs));
   select coalesce(jsonb_agg(x),'[]') into v_topics from jsonb_array_elements(v_topics) x where x->>'id'<>v_id::text;
  end if;
  v_topics:=v_topics||jsonb_build_array(v_topic);
 end loop;
 select coalesce(jsonb_agg(r),'[]') into v_relations from (
  select r||jsonb_build_object('source',public.canonical_topic_id(p_user,(r->>'source')::uuid),'target',public.canonical_topic_id(p_user,(r->>'target')::uuid)) r
  from jsonb_array_elements(p_analysis->'relations') r
 ) canonical where r->>'source'<>r->>'target' and exists(select 1 from jsonb_array_elements(v_topics) t where t->>'id'=r->>'source') and exists(select 1 from jsonb_array_elements(v_topics) t where t->>'id'=r->>'target');
 return p_analysis||jsonb_build_object('topics',v_topics,'relations',v_relations);
end;
$$;
revoke execute on function public.canonical_topic_id(uuid,uuid),public.apply_topic_rules(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.canonical_topic_id(uuid,uuid),public.apply_topic_rules(uuid,jsonb) to service_role;

create function public.enforce_topic_rules() returns trigger language plpgsql security definer set search_path='' as $$
declare v_override jsonb;
begin
 if new.analysis is not null then
  if auth.uid() is distinct from new.user_id then
   select analysis into v_override from public.source_topic_overrides where source_id=new.source_id and user_id=new.user_id;
   new.analysis:=coalesce(v_override,new.analysis);
  end if;
  new.analysis:=public.apply_topic_rules(new.user_id,new.analysis);
  if exists(select 1 from jsonb_array_elements(new.analysis->'topics') t,lateral jsonb_array_elements_text(t->'citation_ids') c
   where not exists(select 1 from public.source_studies s,lateral jsonb_array_elements(s.note->'references') r where s.source_id=new.source_id and s.user_id=new.user_id and r->>'id'=c)) then
   raise exception using errcode='22023',message='Topic evidence unavailable';
  end if;
 end if;
 return new;
end;
$$;
revoke execute on function public.enforce_topic_rules() from public,anon,authenticated;
create trigger enforce_topic_rules before insert or update of analysis on public.source_topic_maps
for each row execute function public.enforce_topic_rules();

create function public.remember_source_topics() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.analysis is not null and auth.uid()=new.user_id and coalesce(current_setting('app.topic_global',true),'false')<>'true' then
  insert into public.source_topic_overrides(source_id,user_id,analysis) values(new.source_id,new.user_id,new.analysis)
  on conflict(source_id) do update set analysis=excluded.analysis;
 end if;
 return new;
end;
$$;
revoke execute on function public.remember_source_topics() from public,anon,authenticated;
create trigger remember_source_topics after update of analysis on public.source_topic_maps
 for each row execute function public.remember_source_topics();

create function public.correct_topic_library(p_action jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid:=(p_action->>'topic_id')::uuid;v_target uuid:=(p_action->>'target_id')::uuid;v_title text:=btrim(p_action->>'title');v_meta jsonb;v_decisions jsonb;v_source uuid;v_other uuid;
 v_map public.source_topic_maps;v_topic jsonb;v_topics jsonb:='[]';v_refs jsonb;v_relations jsonb;v_old_global text;
begin
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 if p_action->>'action'='connection' then
  v_source:=least((p_action->>'source')::uuid,(p_action->>'target')::uuid);
  v_other:=greatest((p_action->>'source')::uuid,(p_action->>'target')::uuid);
  if v_source=v_other or v_source is null or v_other is null or p_action->>'state' is null or p_action->>'state' not in ('accepted','rejected') then raise exception using errcode='22023',message='Invalid connection';end if;
  if not exists(select 1 from public.topic_connection_decisions where user_id=v_user and source=v_source and target=v_other) and
   (not exists(select 1 from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t where m.user_id=v_user and m.status='succeeded' and t->>'id'=v_source::text) or
    not exists(select 1 from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t where m.user_id=v_user and m.status='succeeded' and t->>'id'=v_other::text)) then raise exception using errcode='P0002',message='Connection unavailable';end if;
  insert into public.topic_connection_decisions(user_id,source,target,state) values(v_user,v_source,v_other,p_action->>'state')
  on conflict(user_id,source,target) do update set state=excluded.state;
  return true;
 end if;
 if p_action->>'action'='assign' then
  v_source:=(p_action->>'source_id')::uuid;
  select * into v_map from public.source_topic_maps where source_id=v_source and user_id=v_user and status='succeeded' for update;
  if not found then raise exception using errcode='P0002',message='Completed source not found';end if;
  if jsonb_typeof(p_action->'topic_ids') is distinct from 'array' or jsonb_array_length(p_action->'topic_ids') not between 1 and 12 or
   jsonb_typeof(p_action->'evidence_ids') is distinct from 'array' or jsonb_array_length(p_action->'evidence_ids') not between 1 and 10 then raise exception using errcode='22023',message='Choose topics and supporting passages';end if;
  if (select count(distinct t) from jsonb_array_elements_text(p_action->'topic_ids') t)<>jsonb_array_length(p_action->'topic_ids') then raise exception using errcode='22023',message='Duplicate topics';end if;
  if exists(select 1 from jsonb_array_elements_text(p_action->'evidence_ids') c where not exists(select 1 from public.source_studies s,lateral jsonb_array_elements(s.note->'references') r where s.source_id=v_source and s.user_id=v_user and s.status='succeeded' and r->>'id'=c)) then raise exception using errcode='22023',message='Invalid source evidence';end if;
  v_refs:=p_action->'evidence_ids';
  for v_id in select t::uuid from jsonb_array_elements_text(p_action->'topic_ids') t loop
   select t into v_topic from jsonb_array_elements(v_map.analysis->'topics') t where t->>'id'=v_id::text;
   if v_topic is null then
    select t into v_topic from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t where m.user_id=v_user and m.status='succeeded' and t->>'id'=v_id::text limit 1;
    if v_topic is null then raise exception using errcode='P0002',message='Assigned topic unavailable';end if;
    v_topic:=v_topic||jsonb_build_object('role','supporting','citation_ids',v_refs);
   end if;
   v_topics:=v_topics||jsonb_build_array(v_topic||jsonb_build_object('uncertain',false,'suggested_topic_id',null,'placement_reason','Source assignment corrected by the learner.'));
  end loop;
  if not exists(select 1 from jsonb_array_elements(v_topics) t where t->>'role'='main') then
   v_topics:=jsonb_set(v_topics,'{0,role}','"main"');
  end if;
  select coalesce(jsonb_agg(r),'[]') into v_relations from jsonb_array_elements(v_map.analysis->'relations') r
   where p_action->'topic_ids' ? (r->>'source') and p_action->'topic_ids' ? (r->>'target');
  update public.source_topic_maps set analysis=analysis||jsonb_build_object('topics',v_topics,'relations',v_relations),updated_at=clock_timestamp() where source_id=v_source;
  return true;
 end if;
 if not exists(select 1 from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t where m.user_id=v_user and m.status='succeeded' and t->>'id'=v_id::text) then
  raise exception using errcode='P0002',message='Topic not found';
 end if;
 v_old_global:=coalesce(current_setting('app.topic_global',true),'false');
 perform set_config('app.topic_global','true',true);
 if p_action->>'action'='rename' then
  if length(v_title) not between 1 and 100 or v_title is null then raise exception using errcode='22023',message='Invalid topic name';end if;
  insert into public.topic_rules(user_id,topic_id,title) values(v_user,v_id,v_title)
  on conflict(user_id,topic_id) do update set title=excluded.title;
 elsif p_action->>'action'='merge' then
  select t-'id'-'role'-'citation_ids'-'uncertain'-'suggested_topic_id'-'placement_reason' into v_meta from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t
  where m.user_id=v_user and m.status='succeeded' and t->>'id'=v_target::text limit 1;
  if v_meta is null or v_target=v_id then raise exception using errcode='P0002',message='Merge target unavailable';end if;
  insert into public.topic_rules(user_id,topic_id,target_id,descriptor) values(v_user,v_id,v_target,v_meta)
  on conflict(user_id,topic_id) do update set target_id=excluded.target_id,descriptor=excluded.descriptor,title=null;
  update public.topic_rules set target_id=v_target,descriptor=v_meta where user_id=v_user and target_id=v_id;
  -- A rejected pair wins when merge redirects collapse several decisions.
  select jsonb_agg(jsonb_build_object('source',source,'target',target,'state',state)) into v_decisions from (
   select least(s,t) source,greatest(s,t) target,case when bool_or(state='rejected') then 'rejected' else 'accepted' end state from (
    select public.canonical_topic_id(v_user,source) s,public.canonical_topic_id(v_user,target) t,state
    from public.topic_connection_decisions where user_id=v_user
   ) remapped where s<>t group by least(s,t),greatest(s,t)
  ) pairs;
  delete from public.topic_connection_decisions where user_id=v_user;
  insert into public.topic_connection_decisions(user_id,source,target,state)
   select v_user,(d->>'source')::uuid,(d->>'target')::uuid,d->>'state' from jsonb_array_elements(v_decisions) d;
 else raise exception using errcode='22023',message='Invalid correction';end if;
 update public.source_topic_maps set analysis=public.apply_topic_rules(v_user,analysis),updated_at=clock_timestamp()
 where user_id=v_user and status='succeeded' and analysis is distinct from public.apply_topic_rules(v_user,analysis);
 perform set_config('app.topic_global',v_old_global,true);
 return true;
end;
$$;
revoke execute on function public.correct_topic_library(jsonb) from public,anon;
grant execute on function public.correct_topic_library(jsonb) to authenticated;
-- Use the same owner-first lock order as corrections to avoid claim/mutation deadlocks.
create or replace function public.claim_source_topics(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_map public.source_topic_maps; v_note jsonb;v_user uuid;
begin
  select user_id into v_user from public.source_topic_maps where source_id=p_source_id;
  if not found then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into v_map from public.source_topic_maps where source_id = p_source_id
    and status = 'queued' and attempts < max_attempts and next_attempt_at <= now()
    for update skip locked;
  if not found then return null; end if;
  -- Serialize this learner's catalog matching; no simultaneous alias decisions.
  if exists (select 1 from public.source_topic_maps where user_id = v_map.user_id
      and status = 'processing' and lease_until > now()) then return null; end if;
  select note into v_note from public.source_studies where source_id = p_source_id and status = 'succeeded';
  if v_note is null then return null; end if;
  update public.source_topic_maps set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_map;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_map.user_id,
    'note',v_note,'lease_token',v_map.lease_token,'attempt',v_map.attempts);
end;
$$;


-- Completion must serialize with corrections before taking the source row lock.
create or replace function public.finish_source_topics(p_source_id uuid,p_lease_token uuid,p_analysis jsonb,p_error_code text)
returns boolean language plpgsql set search_path = '' as $$
declare v_study public.source_topic_maps;v_user uuid;
begin
  if (p_analysis is null) = (p_error_code is null) then
    raise exception 'Provide either a validated analysis or an error code';
  end if;
  select user_id into v_user from public.source_topic_maps where source_id=p_source_id;
  if not found then return false;end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into v_study from public.source_topic_maps where source_id = p_source_id
    and status = 'processing' and lease_token = p_lease_token and lease_until > now() for update;
  if not found then return false; end if;
  if p_analysis is not null then
    update public.source_topic_maps set status = 'succeeded',analysis = p_analysis,
      error_code = null,lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id;
    delete from public.topic_outbox where source_id = p_source_id;
  else
    update public.source_topic_maps set
      status = case when attempts >= max_attempts or p_error_code = 'setup_required' then 'failed' else 'queued' end,
      analysis = null,error_code = p_error_code,lease_token = null,lease_until = null,
      next_attempt_at = now() + make_interval(secs => case when attempts = 1 then 10 else 30 end),
      updated_at = now() where source_id = p_source_id returning * into v_study;
    if v_study.status = 'queued' then
      update public.topic_outbox set next_delivery_at = v_study.next_attempt_at where source_id = p_source_id;
    else
      delete from public.topic_outbox where source_id = p_source_id;
    end if;
  end if;
  return true;
end;
$$;


commit;
