-- Derived web retrieval only. Captures/notes stay authoritative and unchanged.
begin;
create table public.retrieval_indexes (
 source_id uuid primary key, user_id uuid not null,
 source_version integer not null check(source_version between 1 and 20),
 generation uuid not null default gen_random_uuid(),
 capture_sha256 text not null check(capture_sha256 ~ '^[a-f0-9]{64}$'),
 chunk_policy text not null default 'structure_recursive_v1' check(chunk_policy='structure_recursive_v1'),
 embedding_model text not null default 'text-embedding-3-small' check(embedding_model='text-embedding-3-small'),
 embedding_dimensions integer not null default 1536 check(embedding_dimensions=1536),
 collection_name text not null default 'web_sources_recursive_v1_openai_small_1536',
 action text not null check(action in ('index','delete')),
 status text not null default 'queued' check(status in ('queued','processing','ready','failed','cleaned')),
 attempts integer not null default 0 check(attempts between 0 and 3),
 chunks_total integer not null default 0 check(chunks_total between 0 and 2000),
 chunks_completed integer not null default 0 check(chunks_completed between 0 and chunks_total),
 lease_token uuid,lease_until timestamptz,
 next_attempt_at timestamptz not null default now(),
 error_code text check(error_code in ('provider_unavailable','worker_interrupted')),
 updated_at timestamptz not null default now()
);
-- No source FK: a deletion tombstone must survive until Qdrant cleanup succeeds.
alter table public.retrieval_indexes enable row level security;
revoke all on public.retrieval_indexes from public,anon,authenticated;
grant all on public.retrieval_indexes to service_role;
create index retrieval_due on public.retrieval_indexes(status,next_attempt_at);

create function public.queue_retrieval_index() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.source_version=old.source_version and new.captured_text=old.captured_text
   and new.document is not distinct from old.document and new.transcript is not distinct from old.transcript then return new;end if;
 if tg_op='DELETE' then
  insert into public.retrieval_indexes(source_id,user_id,source_version,capture_sha256,action)
   values(old.id,old.user_id,old.source_version,encode(sha256(convert_to(old.captured_text,'UTF8')),'hex'),'delete')
  on conflict(source_id) do update set generation=gen_random_uuid(),action='delete',status='queued',attempts=0,
   chunks_completed=0,chunks_total=0,error_code=null,
   next_attempt_at=greatest(now(),public.retrieval_indexes.lease_until),lease_token=null,lease_until=null,updated_at=now();
  return old;
 end if;
 insert into public.retrieval_indexes(source_id,user_id,source_version,capture_sha256,action)
  values(new.id,new.user_id,new.source_version,encode(sha256(convert_to(new.captured_text,'UTF8')),'hex'),'index')
 on conflict(source_id) do update set source_version=excluded.source_version,capture_sha256=excluded.capture_sha256,
  generation=gen_random_uuid(),action='index',status='queued',attempts=0,chunks_completed=0,chunks_total=0,error_code=null,
  next_attempt_at=greatest(now(),public.retrieval_indexes.lease_until),lease_token=null,lease_until=null,updated_at=now();
 return new;
end;$$;
revoke execute on function public.queue_retrieval_index() from public,anon,authenticated;
create trigger source_retrieval_index after insert or update or delete on public.sources
 for each row execute function public.queue_retrieval_index();
-- Backfill only queues stable IDs. Applying this migration sends no source to AI.
insert into public.retrieval_indexes(source_id,user_id,source_version,capture_sha256,action)
 select id,user_id,source_version,encode(sha256(convert_to(captured_text,'UTF8')),'hex'),'index' from public.sources;

create function public.get_retrieval_index_status(p_source_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object('source_id',s.id,'source_version',s.source_version,
  'status',coalesce(i.status,'queued'),'chunks_total',coalesce(i.chunks_total,0),
  'chunks_completed',coalesce(i.chunks_completed,0),'error_code',i.error_code)
 into v from public.sources s left join public.retrieval_indexes i on i.source_id=s.id
  and i.user_id=s.user_id and i.source_version=s.source_version and i.action='index'
 where s.id=p_source_id and s.user_id=auth.uid();
 if v is null then raise exception using errcode='P0002',message='Source not found';end if;
 return v;
end;$$;
revoke execute on function public.get_retrieval_index_status(uuid) from public,anon;
grant execute on function public.get_retrieval_index_status(uuid) to authenticated;

create function public.due_retrieval_indexes(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 update public.retrieval_indexes set status=case when attempts<3 then 'queued' else 'failed' end,
  lease_token=null,lease_until=null,next_attempt_at=now(),error_code='worker_interrupted',updated_at=now()
 where status='processing' and lease_until<=now();
 return (select coalesce(jsonb_agg(source_id),'[]') from
  (select source_id from public.retrieval_indexes where status='queued' and next_attempt_at<=now()
   and attempts<3 order by next_attempt_at,source_id limit least(greatest(p_limit,1),25)) q);
end;$$;

create function public.claim_retrieval_index(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.retrieval_indexes; s public.sources; owner uuid;
begin
 select user_id into owner from public.retrieval_indexes where source_id=p_source_id;
 if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select * into s from public.sources where id=p_source_id for update;
 select * into v from public.retrieval_indexes where source_id=p_source_id and status='queued'
  and next_attempt_at<=now() and attempts<3 for update skip locked;
 if not found then return null;end if;
 if v.action='index' and (s.id is null or s.user_id<>v.user_id or s.source_version<>v.source_version
  or encode(sha256(convert_to(s.captured_text,'UTF8')),'hex')<>v.capture_sha256) then return null;end if;
 if v.action='delete' and s.id is not null then return null;end if;
 update public.retrieval_indexes set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),
  lease_until=now()+interval '10 minutes',error_code=null,updated_at=now()
 where source_id=p_source_id returning * into v;
 return jsonb_build_object('source_id',v.source_id,'user_id',v.user_id,'source_version',v.source_version,
  'generation',v.generation,'lease_token',v.lease_token,'action',v.action,'capture_sha256',v.capture_sha256,
  'chunks_completed',v.chunks_completed,'captured_text',case when v.action='index' then s.captured_text else null end,
  'document',case when v.action='index' then s.document else null end,
  'transcript',case when v.action='index' then s.transcript else null end);
end;$$;

create function public.checkpoint_retrieval_index(p_source_id uuid,p_generation uuid,p_lease_token uuid,p_completed integer,p_total integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_total not between 1 and 2000 or p_completed not between 0 and p_total then
  raise exception using errcode='22023',message='Invalid indexing checkpoint';end if;
 update public.retrieval_indexes set chunks_total=p_total,chunks_completed=p_completed,
  lease_until=now()+interval '10 minutes',updated_at=now()
 where source_id=p_source_id and generation=p_generation and lease_token=p_lease_token
  and status='processing' and action='index' and lease_until>now()
  and chunks_completed<=p_completed and (chunks_total=0 or chunks_total=p_total)
  and exists(select 1 from public.sources s where s.id=p_source_id and s.user_id=retrieval_indexes.user_id
   and s.source_version=retrieval_indexes.source_version);
 return found;
end;$$;

create function public.finish_retrieval_index(p_source_id uuid,p_generation uuid,p_lease_token uuid,p_error_code text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_error_code is not null and p_error_code<>'provider_unavailable' then
  raise exception using errcode='22023',message='Invalid indexing error';end if;
 update public.retrieval_indexes set status=case when p_error_code is not null then
   case when attempts<3 then 'queued' else 'failed' end
   when action='delete' then 'cleaned' else 'ready' end,
  error_code=p_error_code,next_attempt_at=now()+interval '30 seconds'*attempts,
  lease_token=null,lease_until=null,updated_at=now()
 where source_id=p_source_id and generation=p_generation and lease_token=p_lease_token
  and status='processing' and lease_until>now()
  and (p_error_code is not null or action='delete' or (chunks_total>0 and chunks_completed=chunks_total))
  and ((action='delete' and not exists(select 1 from public.sources where id=p_source_id))
   or (action='index' and exists(select 1 from public.sources s where s.id=p_source_id
    and s.user_id=retrieval_indexes.user_id and s.source_version=retrieval_indexes.source_version)));
 return found;
end;$$;
revoke execute on function public.due_retrieval_indexes(integer),public.claim_retrieval_index(uuid),
 public.checkpoint_retrieval_index(uuid,uuid,uuid,integer,integer),public.finish_retrieval_index(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.due_retrieval_indexes(integer),public.claim_retrieval_index(uuid),
 public.checkpoint_retrieval_index(uuid,uuid,uuid,integer,integer),public.finish_retrieval_index(uuid,uuid,uuid,text) to service_role;
commit;
