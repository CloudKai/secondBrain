-- Source captures stay immutable; study processing has its own owned record.
begin;

alter table public.sources add constraint sources_id_owner unique (id, user_id);

create table public.source_studies (
  source_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  max_attempts integer not null default 3 check (max_attempts = 3),
  next_attempt_at timestamptz not null default now(),
  error_code text check (error_code in ('provider_unavailable','invalid_output','timeout','setup_required','worker_interrupted')),
  note jsonb,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (source_id,user_id) references public.sources(id,user_id) on delete cascade,
  check ((status = 'succeeded') = (note is not null)),
  check (note is null or (jsonb_typeof(note) = 'object' and octet_length(note::text) <= 131072)),
  check ((status = 'processing' and lease_token is not null and lease_until is not null)
      or (status <> 'processing' and lease_token is null and lease_until is null))
);

create table public.study_outbox (
  source_id uuid primary key references public.source_studies(source_id) on delete cascade,
  next_delivery_at timestamptz not null default now()
);
create index source_studies_due on public.source_studies(status,next_attempt_at);
create index study_outbox_due on public.study_outbox(next_delivery_at);
alter table public.source_studies enable row level security;
alter table public.study_outbox enable row level security;
revoke all on public.source_studies, public.study_outbox from anon, authenticated;
grant select on public.source_studies to authenticated;
grant select on public.sources to service_role;
grant select,insert,update,delete on public.source_studies, public.study_outbox to service_role;
create policy source_studies_read_own on public.source_studies
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.request_source_study(p_source_id uuid, p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_study public.source_studies;
begin
  select user_id into v_user_id from public.sources
    where id = p_source_id and user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Source not found';
  end if;
  insert into public.source_studies(source_id,user_id)
    values (p_source_id,v_user_id) on conflict (source_id) do nothing;
  select * into v_study from public.source_studies where source_id = p_source_id for update;
  if v_study.status = 'failed' and p_retry then
    update public.source_studies set status = 'queued',attempts = 0,
      next_attempt_at = now(),error_code = null,note = null,
      lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id returning * into v_study;
  end if;
  if v_study.status = 'queued' then
    insert into public.study_outbox(source_id,next_delivery_at)
      values (p_source_id,v_study.next_attempt_at) on conflict (source_id) do nothing;
  end if;
  -- Lease fields belong to the worker, not the learner response.
  return to_jsonb(v_study) - 'lease_token' - 'lease_until';
end;
$$;
revoke execute on function public.request_source_study(uuid,boolean) from public, anon;
grant execute on function public.request_source_study(uuid,boolean) to authenticated;

create function public.due_study_dispatches(p_limit integer default 25)
returns table (source_id uuid) language plpgsql set search_path = '' as $$
begin
  -- Expired leases recover cancelled workers; attempts bound total model calls.
  update public.source_studies s set
    status = case when attempts >= max_attempts then 'failed' else 'queued' end,
    error_code = 'worker_interrupted',lease_token = null,lease_until = null,
    next_attempt_at = now(),updated_at = now()
    where s.status = 'processing' and s.lease_until <= now();
  delete from public.study_outbox o using public.source_studies s
    where o.source_id = s.source_id and s.status in ('succeeded','failed');
  return query select s.source_id from public.source_studies s
    join public.study_outbox o on o.source_id = s.source_id
    where s.status = 'queued' and s.next_attempt_at <= now() and o.next_delivery_at <= now()
    order by o.next_delivery_at,s.source_id limit least(greatest(p_limit,1),100);
end;
$$;

create function public.ack_study_dispatch(p_source_id uuid)
returns void language sql set search_path = '' as $$
  -- Redeliver until the database sees a claim: Redis loss cannot lose a job.
  update public.study_outbox set next_delivery_at = now() + interval '30 seconds'
    where source_id = p_source_id;
$$;

create function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_study public.source_studies; v_text text;
begin
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text into v_text from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'captured_text',v_text,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;

create function public.finish_source_study(p_source_id uuid,p_lease_token uuid,p_note jsonb,p_error_code text)
returns boolean language plpgsql set search_path = '' as $$
declare v_study public.source_studies;
begin
  if (p_note is null) = (p_error_code is null) then
    raise exception 'Provide either a validated note or an error code';
  end if;
  select * into v_study from public.source_studies where source_id = p_source_id
    and status = 'processing' and lease_token = p_lease_token and lease_until > now() for update;
  if not found then return false; end if;
  if p_note is not null then
    update public.source_studies set status = 'succeeded',note = p_note,
      error_code = null,lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id;
    delete from public.study_outbox where source_id = p_source_id;
  else
    update public.source_studies set
      status = case when attempts >= max_attempts or p_error_code = 'setup_required' then 'failed' else 'queued' end,
      note = null,error_code = p_error_code,lease_token = null,lease_until = null,
      next_attempt_at = now() + make_interval(secs => case when attempts = 1 then 10 else 30 end),
      updated_at = now() where source_id = p_source_id returning * into v_study;
    if v_study.status = 'queued' then
      update public.study_outbox set next_delivery_at = v_study.next_attempt_at where source_id = p_source_id;
    else
      delete from public.study_outbox where source_id = p_source_id;
    end if;
  end if;
  return true;
end;
$$;

revoke execute on function public.due_study_dispatches(integer), public.ack_study_dispatch(uuid),
  public.claim_source_study(uuid),public.finish_source_study(uuid,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.due_study_dispatches(integer), public.ack_study_dispatch(uuid),
  public.claim_source_study(uuid),public.finish_source_study(uuid,uuid,jsonb,text) to service_role;

commit;
