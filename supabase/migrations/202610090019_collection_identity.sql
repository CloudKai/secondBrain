-- Independent owned collection identity, preserving legacy learning history.
begin;

create table public.learning_collections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 legacy_source_id uuid not null,
 title text not null check(char_length(title) between 1 and 200),
 goal text not null default '' check(char_length(goal)<=500),
 revision bigint not null default 1 check(revision>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,legacy_source_id),
 unique(id,user_id),
 unique(id,user_id,legacy_source_id)
);
-- There is deliberately no FK from the legacy alias to a removable capture.
alter table public.sources add constraint sources_identity_owner unique(id,user_id);
create table public.learning_collection_sources (
 collection_id uuid not null,
 user_id uuid not null,
 source_id uuid not null,
 added_at timestamptz not null default now(),
 primary key(collection_id,source_id),
 foreign key(collection_id,user_id) references public.learning_collections(id,user_id) on delete cascade,
 foreign key(source_id,user_id) references public.sources(id,user_id) on delete cascade
);
create index learning_collection_sources_owner on public.learning_collection_sources(user_id,source_id);
alter table public.learning_collections enable row level security;
alter table public.learning_collection_sources enable row level security;
revoke all on public.learning_collections,public.learning_collection_sources from public,anon,authenticated;
grant select on public.learning_collections,public.learning_collection_sources to authenticated;
create policy learning_collections_owned on public.learning_collections for select to authenticated using(user_id=(select auth.uid()));
create policy learning_collection_sources_owned on public.learning_collection_sources for select to authenticated using(user_id=(select auth.uid()));
alter table public.learning_paths add column collection_id uuid;
alter table public.learning_places add column collection_id uuid;

create function public.backfill_learning_collections() returns jsonb
language plpgsql security definer set search_path='' as $$
declare missing_paths bigint;missing_places bigint;missing_plans bigint;missing_attempts bigint;missing_activities bigint;
begin
 insert into public.learning_collections(user_id,legacy_source_id,title,goal,created_at,updated_at)
 select p.user_id,p.original_source_id,p.source_title,
 coalesce((select n.goal from public.learning_places l join public.learning_plans n on n.id=l.plan_id and n.user_id=l.user_id
  where l.user_id=p.user_id and l.original_source_id=p.original_source_id),
  (select n.goal from public.learning_plans n join public.learning_paths lp on lp.id=n.path_id and lp.user_id=n.user_id
   where lp.user_id=p.user_id and lp.original_source_id=p.original_source_id and n.confirmed_at is not null
   order by n.created_at desc,n.id limit 1),''),
 (select min(lp.created_at) from public.learning_paths lp where lp.user_id=p.user_id and lp.original_source_id=p.original_source_id),
 (select max(lp.created_at) from public.learning_paths lp where lp.user_id=p.user_id and lp.original_source_id=p.original_source_id)
 from (select distinct on(user_id,original_source_id) * from public.learning_paths order by user_id,original_source_id,created_at desc,id) p
 on conflict(user_id,legacy_source_id) do nothing;
 update public.learning_paths p set collection_id=c.id from public.learning_collections c
 where p.user_id=c.user_id and p.original_source_id=c.legacy_source_id and p.collection_id is null;
 update public.learning_places l set collection_id=c.id from public.learning_collections c
 where l.user_id=c.user_id and l.original_source_id=c.legacy_source_id and l.collection_id is null;
 insert into public.learning_collection_sources(collection_id,user_id,source_id)
 select c.id,c.user_id,s.id from public.learning_collections c join public.sources s on s.id=c.legacy_source_id and s.user_id=c.user_id
 on conflict do nothing;
 insert into public.learning_collection_sources(collection_id,user_id,source_id)
 select distinct p.collection_id,n.user_id,s.id from public.learning_plans n join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
 cross join lateral jsonb_array_elements(n.source_members) m join public.sources s on s.id=(m->>'source_id')::uuid and s.user_id=n.user_id
 where n.confirmed_at is not null
 on conflict do nothing;
 select count(*) into missing_paths from public.learning_paths p left join public.learning_collections c
 on c.id=p.collection_id and c.user_id=p.user_id and c.legacy_source_id=p.original_source_id where c.id is null;
 select count(*) into missing_places from public.learning_places l left join public.learning_collections c
 on c.id=l.collection_id and c.user_id=l.user_id and c.legacy_source_id=l.original_source_id
 left join public.learning_plans n on n.id=l.plan_id and n.user_id=l.user_id
 left join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id and p.collection_id=c.id
 where c.id is null or p.id is null or n.confirmed_at is null or l.lesson_index>=jsonb_array_length(n.content->'lessons');
 select count(*) into missing_plans from public.learning_plans n left join public.learning_paths p
 on p.id=n.path_id and p.user_id=n.user_id where p.id is null or p.collection_id is null;
 select count(*) into missing_attempts from public.learning_attempts a left join public.learning_plans n
 on n.id=a.plan_id and n.user_id=a.user_id where n.id is null;
 select count(*) into missing_activities from public.learning_activities a left join public.learning_plans n
 on n.id=a.plan_id and n.user_id=a.user_id where n.id is null;
 if missing_paths+missing_places+missing_plans+missing_attempts+missing_activities<>0 then
  raise exception using errcode='40001',message='Unmapped learning roots; collection backfill aborted';end if;
 return jsonb_build_object('collections',(select count(*) from public.learning_collections),
 'paths',(select count(*) from public.learning_paths),'places',(select count(*) from public.learning_places),
 'plans',(select count(*) from public.learning_plans),'attempts',(select count(*) from public.learning_attempts),
 'unmapped_paths',missing_paths,'unmapped_places',missing_places,'unmapped_plans',missing_plans,
 'unmapped_attempts',missing_attempts,'unmapped_activities',missing_activities);
end;$$;
revoke execute on function public.backfill_learning_collections() from public,anon,authenticated;
grant execute on function public.backfill_learning_collections() to service_role;

-- This metadata-only attachment is not a new learner selection. ALTER TABLE
-- holds the table lock until commit; timestamping is restored before rollout.
alter table public.learning_places disable trigger learning_place_timestamp;
select public.backfill_learning_collections();
alter table public.learning_places enable trigger learning_place_timestamp;
alter table public.learning_paths alter column collection_id set not null;
alter table public.learning_places alter column collection_id set not null;
alter table public.learning_paths add constraint learning_paths_collection foreign key(collection_id,user_id,original_source_id)
 references public.learning_collections(id,user_id,legacy_source_id);
alter table public.learning_places add constraint learning_places_collection foreign key(collection_id,user_id,original_source_id)
 references public.learning_collections(id,user_id,legacy_source_id);
create index learning_paths_collection on public.learning_paths(user_id,collection_id);

create function public.attach_learning_path_collection() returns trigger
language plpgsql security definer set search_path='' as $$
declare identity uuid;
begin
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.original_source_id<>old.original_source_id or new.collection_id<>old.collection_id) then
  raise exception using errcode='40001',message='Learning collection identity is immutable';end if;
 insert into public.learning_collections(user_id,legacy_source_id,title,created_at,updated_at)
 values(new.user_id,new.original_source_id,new.source_title,new.created_at,new.created_at)
 on conflict(user_id,legacy_source_id) do nothing;
 select id into identity from public.learning_collections where user_id=new.user_id and legacy_source_id=new.original_source_id;
 if new.collection_id is not null and new.collection_id<>identity then
  raise exception using errcode='40001',message='Learning collection identity changed';end if;
 new.collection_id:=identity;
 insert into public.learning_collection_sources(collection_id,user_id,source_id)
 select identity,new.user_id,s.id from public.sources s where s.id=new.original_source_id and s.user_id=new.user_id
 on conflict do nothing;
 return new;
end;$$;
revoke execute on function public.attach_learning_path_collection() from public,anon,authenticated;
create trigger learning_path_collection before insert or update of user_id,original_source_id,collection_id on public.learning_paths
 for each row execute function public.attach_learning_path_collection();

create function public.attach_learning_place_collection() returns trigger
language plpgsql security definer set search_path='' as $$
declare identity uuid;
begin
 select p.collection_id into identity from public.learning_paths p join public.learning_plans n on n.path_id=p.id and n.user_id=p.user_id
 where n.id=new.plan_id and n.user_id=new.user_id and p.original_source_id=new.original_source_id;
 if identity is null or new.collection_id is not null and new.collection_id<>identity then
  raise exception using errcode='P0002',message='Collection place not found';end if;
 new.collection_id:=identity;
 return new;
end;$$;
revoke execute on function public.attach_learning_place_collection() from public,anon,authenticated;
create trigger learning_place_collection before insert or update on public.learning_places
 for each row execute function public.attach_learning_place_collection();

create function public.attach_confirmed_collection_sources() returns trigger
language plpgsql security definer set search_path='' as $$
declare identity uuid;
begin
 if new.confirmed_at is null then return new;end if;
 select collection_id into identity from public.learning_paths where id=new.path_id and user_id=new.user_id;
 insert into public.learning_collection_sources(collection_id,user_id,source_id)
 select distinct identity,new.user_id,s.id from jsonb_array_elements(new.source_members) member
 join public.sources s on s.id=(member->>'source_id')::uuid and s.user_id=new.user_id
 on conflict do nothing;
 update public.learning_collections set goal=new.goal,revision=revision+1,updated_at=now()
 where id=identity and user_id=new.user_id and goal='';
 return new;
end;$$;
revoke execute on function public.attach_confirmed_collection_sources() from public,anon,authenticated;
create trigger learning_confirmed_collection_sources after insert or update of confirmed_at on public.learning_plans
 for each row execute function public.attach_confirmed_collection_sources();

create function public.learning_collection_summary(p_collection_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 select jsonb_build_object('id',c.id,'legacy_source_id',c.legacy_source_id,'title',c.title,'goal',c.goal,'revision',c.revision,
 'created_at',c.created_at,'updated_at',c.updated_at,
 'original_source_available',exists(select 1 from public.sources s where s.id=c.legacy_source_id and s.user_id=c.user_id),
 'source_count',(select count(*) from public.learning_collection_sources m where m.collection_id=c.id and m.user_id=c.user_id),
 'path_count',(select count(*) from public.learning_paths p where p.collection_id=c.id and p.user_id=c.user_id
  and exists(select 1 from public.learning_plans n where n.path_id=p.id and n.user_id=p.user_id and n.confirmed_at is not null))) into result
 from public.learning_collections c where c.id=p_collection_id and c.user_id=auth.uid();
 if result is null then raise exception using errcode='P0002',message='Collection not found';end if;
 return result;
end;$$;
revoke execute on function public.learning_collection_summary(uuid) from public,anon,authenticated;

create function public.get_learning_collection(p_collection_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare summary jsonb;members jsonb;
begin
 summary:=public.learning_collection_summary(p_collection_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'source_kind',s.source_kind,'source_version',s.source_version)
  order by m.added_at,s.id),'[]') into members
 from public.learning_collection_sources m join public.sources s on s.id=m.source_id and s.user_id=m.user_id
 where m.collection_id=p_collection_id and m.user_id=auth.uid();
 return jsonb_build_object('user_id',auth.uid(),'collection',summary,'sources',members,
 'learning',public.get_source_learning((summary->>'legacy_source_id')::uuid));
end;$$;
revoke execute on function public.get_learning_collection(uuid) from public,anon,authenticated;
grant execute on function public.get_learning_collection(uuid) to authenticated;

create function public.resolve_source_learning_collection(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity uuid;
begin
 select id into identity from public.learning_collections where user_id=auth.uid() and legacy_source_id=p_source_id;
 if identity is null then raise exception using errcode='P0002',message='Collection not found';end if;
 return public.get_learning_collection(identity);
end;$$;
revoke execute on function public.resolve_source_learning_collection(uuid) from public,anon,authenticated;
grant execute on function public.resolve_source_learning_collection(uuid) to authenticated;

create function public.list_learning_collections(p_offset integer default 0,p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare items jsonb;total bigint;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='Collections not found';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then
  raise exception using errcode='22023',message='Invalid collection page';end if;
 select count(*) into total from public.learning_collections where user_id=auth.uid();
 select coalesce(jsonb_agg(public.learning_collection_summary(c.id) order by c.updated_at desc,c.id),'[]') into items
 from (select id,updated_at from public.learning_collections where user_id=auth.uid() order by updated_at desc,id offset p_offset limit p_limit) c;
 return jsonb_build_object('user_id',auth.uid(),'collections',items,
 'next_offset',case when p_offset+p_limit<total then p_offset+p_limit else null end);
end;$$;
revoke execute on function public.list_learning_collections(integer,integer) from public,anon,authenticated;
grant execute on function public.list_learning_collections(integer,integer) to authenticated;

create function public.select_learning_collection_lesson(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid()) then
  raise exception using errcode='P0002',message='Collection not found';end if;
 if not exists(select 1 from public.learning_plans n join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  where n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null and p.collection_id=p_collection_id) then
  raise exception using errcode='P0002',message='Collection plan not found';end if;
 perform public.select_learning_lesson_checked(p_plan_id,p_lesson_index,p_expected_revision);
 return public.get_learning_collection(p_collection_id);
end;$$;
revoke execute on function public.select_learning_collection_lesson(uuid,uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.select_learning_collection_lesson(uuid,uuid,integer,bigint) to authenticated;
commit;
