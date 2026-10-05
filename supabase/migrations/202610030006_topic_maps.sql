-- Topic mapping is separate from immutable source notes; no vector service needed.
begin;



create table public.source_topic_maps (
  source_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts = 3),
  next_attempt_at timestamptz not null default now(),
  error_code text check (error_code in ('provider_unavailable','invalid_output','timeout','setup_required','worker_interrupted')),
  analysis jsonb,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (source_id,user_id) references public.sources(id,user_id) on delete cascade,
  check ((status = 'succeeded') = (analysis is not null)),
  check (analysis is null or (jsonb_typeof(analysis) = 'object' and octet_length(analysis::text) <= 131072)),
  check ((status = 'processing' and lease_token is not null and lease_until is not null)
      or (status <> 'processing' and lease_token is null and lease_until is null))
);

create table public.topic_outbox (
  source_id uuid primary key references public.source_topic_maps(source_id) on delete cascade,
  next_delivery_at timestamptz not null default now()
);
create index source_topic_maps_due on public.source_topic_maps(status,next_attempt_at);
create index topic_outbox_due on public.topic_outbox(next_delivery_at);
alter table public.source_topic_maps enable row level security;
alter table public.topic_outbox enable row level security;
revoke all on public.source_topic_maps, public.topic_outbox from anon, authenticated;
grant select on public.source_topic_maps to authenticated;
grant select on public.sources to service_role;
grant select,insert,update,delete on public.source_topic_maps, public.topic_outbox to service_role;
create policy source_topic_maps_read_own on public.source_topic_maps
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.request_source_topics(p_source_id uuid, p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_study public.source_topic_maps;
begin
  select user_id into v_user_id from public.sources
    where id = p_source_id and user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Source not found';
  end if;
  if not exists (select 1 from public.source_studies where source_id = p_source_id and status = 'succeeded') then
    raise exception using errcode = 'P0002', message = 'Completed source note not found';
  end if;
  insert into public.source_topic_maps(source_id,user_id)
    values (p_source_id,v_user_id) on conflict (source_id) do nothing;
  select * into v_study from public.source_topic_maps where source_id = p_source_id for update;
  if v_study.status = 'failed' and p_retry then
    update public.source_topic_maps set status = 'queued',attempts = 0,
      next_attempt_at = now(),error_code = null,analysis = null,
      lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id returning * into v_study;
  end if;
  if v_study.status = 'queued' then
    insert into public.topic_outbox(source_id,next_delivery_at)
      values (p_source_id,v_study.next_attempt_at) on conflict (source_id) do nothing;
  end if;
  -- Lease fields belong to the worker, not the learner response.
  return to_jsonb(v_study) - 'lease_token' - 'lease_until';
end;
$$;
revoke execute on function public.request_source_topics(uuid,boolean) from public, anon;
grant execute on function public.request_source_topics(uuid,boolean) to authenticated;

create function public.due_topic_dispatches(p_limit integer default 25)
returns table (source_id uuid) language plpgsql set search_path = '' as $$
begin
  -- Expired leases recover cancelled workers; attempts bound total model calls.
  update public.source_topic_maps s set
    status = case when attempts >= max_attempts then 'failed' else 'queued' end,
    error_code = 'worker_interrupted',lease_token = null,lease_until = null,
    next_attempt_at = now(),updated_at = now()
    where s.status = 'processing' and s.lease_until <= now();
  delete from public.topic_outbox o using public.source_topic_maps s
    where o.source_id = s.source_id and s.status in ('succeeded','failed');
  return query select s.source_id from public.source_topic_maps s
    join public.topic_outbox o on o.source_id = s.source_id
    where s.status = 'queued' and s.next_attempt_at <= now() and o.next_delivery_at <= now()
    order by o.next_delivery_at,s.source_id limit least(greatest(p_limit,1),100);
end;
$$;

create function public.ack_topic_dispatch(p_source_id uuid)
returns void language sql set search_path = '' as $$
  -- Redeliver until the database sees a claim: Redis loss cannot lose a job.
  update public.topic_outbox set next_delivery_at = now() + interval '30 seconds'
    where source_id = p_source_id;
$$;

create function public.claim_source_topics(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_map public.source_topic_maps; v_note jsonb;
begin
  select * into v_map from public.source_topic_maps where source_id = p_source_id
    and status = 'queued' and attempts < max_attempts and next_attempt_at <= now()
    for update skip locked;
  if not found then return null; end if;
  -- Serialize this learner's catalog matching; no simultaneous alias decisions.
  perform pg_advisory_xact_lock(hashtextextended(v_map.user_id::text, 0));
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

create function public.finish_source_topics(p_source_id uuid,p_lease_token uuid,p_analysis jsonb,p_error_code text)
returns boolean language plpgsql set search_path = '' as $$
declare v_study public.source_topic_maps;
begin
  if (p_analysis is null) = (p_error_code is null) then
    raise exception 'Provide either a validated analysis or an error code';
  end if;
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

revoke execute on function public.due_topic_dispatches(integer), public.ack_topic_dispatch(uuid),
  public.claim_source_topics(uuid),public.finish_source_topics(uuid,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.due_topic_dispatches(integer), public.ack_topic_dispatch(uuid),
  public.claim_source_topics(uuid),public.finish_source_topics(uuid,uuid,jsonb,text) to service_role;

create function public.confirm_topic_placement(p_source_id uuid,p_topic_id uuid,p_target_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_map public.source_topic_maps; v_old jsonb; v_target jsonb; v_new jsonb; v_topics jsonb; v_relations jsonb; v_id text;
begin
  select * into v_map from public.source_topic_maps where source_id = p_source_id
    and user_id = auth.uid() and status = 'succeeded' for update;
  if not found then raise exception using errcode = 'P0002',message = 'Source not found'; end if;
  select t into v_old from jsonb_array_elements(v_map.analysis->'topics') t
    where t->>'id' = p_topic_id::text and t->>'uncertain' = 'true';
  if v_old is null then raise exception using errcode = 'P0002',message = 'Placement not found'; end if;
  v_id := coalesce(p_target_id,p_topic_id)::text;
  if p_target_id is not null then
    if v_old->>'suggested_topic_id' is distinct from p_target_id::text then
      raise exception using errcode = 'P0002',message = 'Suggested placement not found';
    end if;
    select t into v_target from public.source_topic_maps m,
      lateral jsonb_array_elements(m.analysis->'topics') t
      where m.user_id = auth.uid() and m.status = 'succeeded' and t->>'id' = p_target_id::text
        and t->>'uncertain' = 'false' limit 1;
    if v_target is null then raise exception using errcode = 'P0002',message = 'Suggested topic no longer available'; end if;
  else v_target := v_old; end if;
  v_new := v_target || jsonb_build_object('id',v_id,'uncertain',false,'suggested_topic_id',null,
    'placement_reason','Placement confirmed by the learner.',
    'role',case when exists(select 1 from jsonb_array_elements(v_map.analysis->'topics') t where t->>'id' in (p_topic_id::text,v_id) and t->>'role' = 'main') then 'main' else 'supporting' end,
    'citation_ids',(select jsonb_agg(c) from (select distinct c from jsonb_array_elements(v_map.analysis->'topics') t,
      lateral jsonb_array_elements(t->'citation_ids') c where t->>'id' in (p_topic_id::text,v_id) order by c limit 10) evidence));
  select coalesce(jsonb_agg(t),'[]'::jsonb) into v_topics from jsonb_array_elements(v_map.analysis->'topics') t where t->>'id' not in (p_topic_id::text,v_id);
  v_topics := v_topics || jsonb_build_array(v_new);
  select coalesce(jsonb_agg(distinct r),'[]'::jsonb) into v_relations from (
    select r || jsonb_build_object('source',case when r->>'source' = p_topic_id::text then v_id else r->>'source' end,
      'target',case when r->>'target' = p_topic_id::text then v_id else r->>'target' end) as r
    from jsonb_array_elements(v_map.analysis->'relations') r
  ) remapped where r->>'source' <> r->>'target';
  update public.source_topic_maps set analysis = analysis || jsonb_build_object('topics',v_topics,'relations',v_relations),updated_at = now()
    where source_id = p_source_id returning * into v_map;
  return to_jsonb(v_map) - 'lease_token' - 'lease_until';
end;
$$;
revoke execute on function public.confirm_topic_placement(uuid,uuid,uuid) from public,anon;
grant execute on function public.confirm_topic_placement(uuid,uuid,uuid) to authenticated;

-- Queue independently and atomically when a source note succeeds.
create function public.enqueue_source_topics() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.status = 'succeeded' then
    insert into public.source_topic_maps(source_id,user_id) values(new.source_id,new.user_id)
      on conflict (source_id) do nothing;
    insert into public.topic_outbox(source_id)
      select source_id from public.source_topic_maps where source_id = new.source_id and status = 'queued'
      on conflict (source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.enqueue_source_topics() from public,anon,authenticated;
create trigger source_note_topics after insert or update of status on public.source_studies
  for each row execute function public.enqueue_source_topics();
insert into public.source_topic_maps(source_id,user_id)
  select source_id,user_id from public.source_studies where status = 'succeeded';
insert into public.topic_outbox(source_id) select source_id from public.source_topic_maps;
commit;
