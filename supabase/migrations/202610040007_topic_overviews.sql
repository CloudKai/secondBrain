-- Read-only synthesis and per-learner view choices; original notes are preserved.
begin;
create table public.topic_overviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null,
  view_mode text not null check (view_mode in ('combined','separate')),
  status text check (status in ('queued','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts=3),
  fingerprint text,
  next_attempt_at timestamptz not null default now(),
  error_code text check (error_code in ('provider_unavailable','invalid_output','timeout','setup_required','worker_interrupted')),
  overview jsonb,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,topic_id),
  check ((status='succeeded') is not distinct from (overview is not null) or status is null and overview is null),
  check (overview is null or (jsonb_typeof(overview)='object' and octet_length(overview::text)<=524288)),
  check ((status='processing' and lease_token is not null and lease_until is not null)
    or (status is distinct from 'processing' and lease_token is null and lease_until is null))
);
create table public.overview_outbox (
  id uuid primary key references public.topic_overviews(id) on delete cascade,
  next_delivery_at timestamptz not null default now()
);
create index topic_overviews_due on public.topic_overviews(status,next_attempt_at);
create index overview_outbox_due on public.overview_outbox(next_delivery_at);
alter table public.topic_overviews enable row level security;
alter table public.overview_outbox enable row level security;
revoke all on public.topic_overviews,public.overview_outbox from anon,authenticated;
-- Results are read through the owned RPC, which hides stale source references.
grant select,insert,update,delete on public.topic_overviews,public.overview_outbox to service_role;

create function public.topic_overview_members(p_user_id uuid,p_topic_id uuid)
returns table(source_id uuid,title text,topic_title text,context text,citation_ids jsonb,
  uncertain boolean,note jsonb,map_updated timestamptz,study_updated timestamptz)
language sql stable set search_path='' as $$
  select s.id,s.title,t->>'title',t->>'context',t->'citation_ids',
    (t->>'uncertain')::boolean,n.note,m.updated_at,n.updated_at
  from public.sources s join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id
  join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id,
  lateral jsonb_array_elements(m.analysis->'topics') t
  where s.user_id=p_user_id and m.status='succeeded' and n.status='succeeded' and t->>'id'=p_topic_id::text
$$;
create function public.topic_overview_fingerprint(p_user_id uuid,p_topic_id uuid)
returns text language sql stable set search_path='' as $$
  -- Membership revisions, not a security hash; notes are authoritative.
  select md5(coalesce(string_agg(source_id::text||':'||map_updated::text||':'||study_updated::text,',' order by source_id),''))
  from public.topic_overview_members(p_user_id,p_topic_id)
$$;
revoke execute on function public.topic_overview_members(uuid,uuid),public.topic_overview_fingerprint(uuid,uuid) from public,anon,authenticated;
grant execute on function public.topic_overview_members(uuid,uuid),public.topic_overview_fingerprint(uuid,uuid) to service_role;

create function public.get_topic_overview(p_topic_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_job public.topic_overviews; v_ids jsonb; v_count integer; v_stale boolean;
begin
  select count(*) into v_count from public.topic_overview_members(v_user,p_topic_id);
  if v_count=0 then raise exception using errcode='P0002',message='Topic not found'; end if;
  select jsonb_agg(source_id order by source_id) into v_ids from
    (select source_id from public.topic_overview_members(v_user,p_topic_id) order by source_id limit 500) members;
  select * into v_job from public.topic_overviews where user_id=v_user and topic_id=p_topic_id;
  v_stale:=v_job.status is not null and v_job.fingerprint is distinct from public.topic_overview_fingerprint(v_user,p_topic_id);
  return jsonb_build_object('topic_id',p_topic_id,'view_mode',coalesce(v_job.view_mode,'combined'),
    'source_ids',v_ids,'source_count',v_count,'needs_refresh',v_stale,
    'record',case when v_job.status is null or v_stale then null else jsonb_build_object(
      'id',v_job.id,'topic_id',p_topic_id,'user_id',v_user,'status',v_job.status,'attempts',v_job.attempts,
      'max_attempts',v_job.max_attempts,'error_code',v_job.error_code,'overview',v_job.overview,'updated_at',v_job.updated_at) end);
end;
$$;
revoke execute on function public.get_topic_overview(uuid) from public,anon;
grant execute on function public.get_topic_overview(uuid) to authenticated;

create function public.set_topic_overview_view(p_topic_id uuid,p_view_mode text,p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_count integer; v_job public.topic_overviews; v_fingerprint text;
begin
  if p_view_mode not in ('combined','separate') or p_view_mode is null then
    raise exception using errcode='22023',message='Invalid topic view';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_topic_id::text,0));
  select count(*) into v_count from public.topic_overview_members(v_user,p_topic_id);
  if v_count=0 then raise exception using errcode='P0002',message='Topic not found'; end if;
  insert into public.topic_overviews(user_id,topic_id,view_mode) values(v_user,p_topic_id,p_view_mode)
    on conflict(user_id,topic_id) do update set view_mode=excluded.view_mode,updated_at=now();
  if p_view_mode='combined' then
    if v_count<2 or exists(select 1 from public.topic_overview_members(v_user,p_topic_id) where uncertain) then
      raise exception using errcode='P0002',message='Two clearly assigned sources are required';
    end if;
    select * into v_job from public.topic_overviews where user_id=v_user and topic_id=p_topic_id for update;
    v_fingerprint:=public.topic_overview_fingerprint(v_user,p_topic_id);
    if v_job.status is null or v_job.fingerprint is distinct from v_fingerprint or (v_job.status='failed' and p_retry) then
      update public.topic_overviews set status='queued',attempts=0,fingerprint=v_fingerprint,
        next_attempt_at=now(),error_code=null,overview=null,lease_token=null,lease_until=null,updated_at=now()
        where id=v_job.id returning * into v_job;
    end if;
    if v_job.status='queued' then
      insert into public.overview_outbox(id,next_delivery_at) values(v_job.id,v_job.next_attempt_at)
        on conflict on constraint overview_outbox_pkey do nothing;
    end if;
  end if;
  return public.get_topic_overview(p_topic_id);
end;
$$;
revoke execute on function public.set_topic_overview_view(uuid,text,boolean) from public,anon;
grant execute on function public.set_topic_overview_view(uuid,text,boolean) to authenticated;


create function public.due_overview_dispatches(p_limit integer default 25)
returns table(id uuid) language plpgsql set search_path='' as $$
begin
  update public.topic_overviews set status=case when attempts>=max_attempts then 'failed' else 'queued' end,
    error_code='worker_interrupted',lease_token=null,lease_until=null,next_attempt_at=now(),updated_at=now()
    where status='processing' and lease_until<=now();
  delete from public.overview_outbox o using public.topic_overviews j where o.id=j.id and j.status='failed';
  insert into public.overview_outbox(id,next_delivery_at)
    select j.id,j.next_attempt_at from public.topic_overviews j where j.status='queued'
    on conflict on constraint overview_outbox_pkey do nothing;
  return query select o.id from public.overview_outbox o join public.topic_overviews j on j.id=o.id
    where j.status='queued' and j.next_attempt_at<=now() and o.next_delivery_at<=now()
    order by o.next_delivery_at limit least(greatest(p_limit,1),25);
end;
$$;
create function public.ack_overview_dispatch(p_id uuid)
returns void language sql set search_path='' as $$
  update public.overview_outbox set next_delivery_at=now()+interval '30 seconds' where id=p_id
$$;
create function public.claim_topic_overview(p_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare v_job public.topic_overviews; v_inputs jsonb; v_count integer;
begin
  select * into v_job from public.topic_overviews where id=p_id and status='queued' and next_attempt_at<=now() for update;
  if not found then return null; end if;
  select count(*) into v_count from public.topic_overview_members(v_job.user_id,v_job.topic_id);
  if v_count<2 or v_job.fingerprint is distinct from public.topic_overview_fingerprint(v_job.user_id,v_job.topic_id) then
    update public.topic_overviews set status='failed',error_code='worker_interrupted',updated_at=now() where id=p_id;
    delete from public.overview_outbox where id=p_id; return null;
  end if;
  if v_job.attempts>=v_job.max_attempts then return null; end if;
  update public.topic_overviews set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',updated_at=now()
    where id=p_id returning * into v_job;
  select jsonb_agg(jsonb_build_object('source_id',source_id,'title',title,'topic_title',topic_title,
    'context',context,'citation_ids',citation_ids,'note',note) order by source_id) into v_inputs from
    (select * from public.topic_overview_members(v_job.user_id,v_job.topic_id) order by source_id limit 20) members;
  return jsonb_build_object('id',v_job.id,'topic_id',v_job.topic_id,'user_id',v_job.user_id,
    'lease_token',v_job.lease_token,'source_count',v_count,'inputs',v_inputs);
end;
$$;
create function public.finish_topic_overview(p_id uuid,p_lease_token uuid,p_overview jsonb default null,p_error_code text default null)
returns boolean language plpgsql set search_path='' as $$
declare v_job public.topic_overviews;
begin
  select * into v_job from public.topic_overviews where id=p_id and status='processing'
    and lease_token=p_lease_token and lease_until>now() for update;
  if not found then return false; end if;
  if v_job.fingerprint is distinct from public.topic_overview_fingerprint(v_job.user_id,v_job.topic_id) then
    update public.topic_overviews set status='failed',error_code='worker_interrupted',lease_token=null,
      lease_until=null,overview=null,updated_at=now() where id=p_id;
    delete from public.overview_outbox where id=p_id; return false;
  end if;
  if p_overview is not null then
    -- Only exact saved passages from current owned topic members may be persisted.
    if exists(select 1 from jsonb_array_elements(p_overview->'references') r where not exists(
      select 1 from public.topic_overview_members(v_job.user_id,v_job.topic_id) m,
        lateral jsonb_array_elements(m.note->'references') ref
      where m.source_id::text=r->>'source_id' and m.title=r->>'title' and ref=r->'passage'
        and m.citation_ids ? (ref->>'id'))) then
      raise exception using errcode='22023',message='Invalid overview evidence';
    end if;
    update public.topic_overviews set status='succeeded',overview=p_overview,error_code=null,
      lease_token=null,lease_until=null,updated_at=now() where id=p_id;
    delete from public.overview_outbox where id=p_id;
  else
    update public.topic_overviews set status=case when attempts>=max_attempts or p_error_code='setup_required' then 'failed' else 'queued' end,
      overview=null,error_code=p_error_code,lease_token=null,lease_until=null,
      next_attempt_at=now()+make_interval(secs=>case when attempts=1 then 10 else 30 end),updated_at=now()
      where id=p_id returning * into v_job;
    if v_job.status='queued' then
      update public.overview_outbox set next_delivery_at=v_job.next_attempt_at where id=p_id;
    else delete from public.overview_outbox where id=p_id; end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.due_overview_dispatches(integer),public.ack_overview_dispatch(uuid),
  public.claim_topic_overview(uuid),public.finish_topic_overview(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.due_overview_dispatches(integer),public.ack_overview_dispatch(uuid),
  public.claim_topic_overview(uuid),public.finish_topic_overview(uuid,uuid,jsonb,text) to service_role;
commit;
