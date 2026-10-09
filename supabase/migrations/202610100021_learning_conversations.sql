-- Owned lesson exchanges. Questions/context never become source evidence.
begin;
create table public.learning_conversations (
 collection_id uuid not null,user_id uuid not null,plan_id uuid not null,
 lesson_index integer not null check(lesson_index between 0 and 3),revision bigint not null default 0 check(revision>=0),
 primary key(collection_id,plan_id,lesson_index),unique(collection_id,plan_id,lesson_index,user_id),
 foreign key(collection_id,user_id) references public.learning_collections(id,user_id) on delete cascade,
 foreign key(plan_id,user_id) references public.learning_plans(id,user_id) on delete cascade
);
create table public.learning_exchanges (
 id uuid primary key,collection_id uuid not null,user_id uuid not null,plan_id uuid not null,lesson_index integer not null,
 question text check(char_length(question) between 1 and 2000),question_hash text not null,
 base_revision bigint not null check(base_revision>=0),status text not null check(status in ('processing','failed','completed','cleared')),
 reply jsonb,redacted boolean not null default false,model text check(model in ('gpt-6-luna','gpt-6.1-sol')),
 policy_version text not null default 'learning_v1' check(policy_version='learning_v1'),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 1 check(attempts between 1 and 3),
 created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(collection_id,plan_id,lesson_index,user_id) references public.learning_conversations(collection_id,plan_id,lesson_index,user_id) on delete cascade
);
alter table public.learning_conversations enable row level security;
alter table public.learning_exchanges enable row level security;
revoke all on public.learning_conversations,public.learning_exchanges from public,anon,authenticated;
grant select on public.learning_conversations,public.learning_exchanges to authenticated;
create policy learning_conversations_owned on public.learning_conversations for select to authenticated using(user_id=(select auth.uid()));
create policy learning_exchanges_owned on public.learning_exchanges for select to authenticated using(user_id=(select auth.uid()));

create function public.get_learning_conversation(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare slot jsonb;items jsonb;r bigint;
begin
 slot:=public.get_learning_draft(p_collection_id,p_plan_id,p_lesson_index,'question');
 select revision into r from public.learning_conversations where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'question',question,'status',status,'reply',reply,'redacted',redacted,
  'model',model,'policy_version',policy_version,'created_at',created_at,'completed_at',completed_at) order by created_at,id),'[]') into items
 from public.learning_exchanges where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and user_id=auth.uid() and status<>'cleared';
 return (slot-'text'-'kind'-'save_id'-'updated_at'-'revision')||jsonb_build_object('revision',coalesce(r,0),'exchanges',items);
end;$$;

create function public.request_learning_conversation(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer,p_request_id uuid,p_question text,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;t public.learning_conversations;r public.learning_exchanges;token uuid;
begin
 -- Serialize learner-wide quota before collection locks, matching generation lock order.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Collection not found';end if;
 result:=public.get_learning_conversation(p_collection_id,p_plan_id,p_lesson_index);
 if p_question is null or char_length(p_question) not between 1 and 2000 or length(btrim(p_question))=0 or p_request_id is null or p_expected_revision is null or p_expected_revision<0 then
  raise exception using errcode='22023',message='Invalid tutor question';end if;
 insert into public.learning_conversations(collection_id,user_id,plan_id,lesson_index) values(p_collection_id,auth.uid(),p_plan_id,p_lesson_index) on conflict do nothing;
 select * into t from public.learning_conversations where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index;
 select * into r from public.learning_exchanges where id=p_request_id;
 if found then
  if r.user_id<>auth.uid() or r.collection_id<>p_collection_id or r.plan_id<>p_plan_id or r.lesson_index<>p_lesson_index or r.question_hash<>md5(p_question) or r.base_revision<>p_expected_revision or r.status='cleared' then
   raise exception using errcode='40001',message='Tutor retry changed or was cleared';end if;
  if r.status='completed' then return jsonb_build_object('conversation',result,'lease_token',null);end if;
 end if;
 if not (result->>'evidence_current')::boolean or t.revision<>p_expected_revision then raise exception using errcode='40001',message='Conversation or source evidence changed';end if;
 if exists(select 1 from public.learning_exchanges where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and status='processing' and lease_until>now()) then
  raise exception using errcode='55P03',message='Tutor request still running';end if;
 if r.id is not null and r.attempts>=3 then raise exception using errcode='54000',message='Tutor retry limit';end if;
 if r.id is null then
  if (select count(*) from public.learning_exchanges where user_id=auth.uid() and created_at>now()-interval '1 hour')>=30 or (select count(*) from public.learning_exchanges where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and status<>'cleared')>=50 then
   raise exception using errcode='54000',message='Tutor conversation limit';end if;
 end if;
 token:=gen_random_uuid();
 insert into public.learning_exchanges(id,collection_id,user_id,plan_id,lesson_index,question,question_hash,base_revision,status,lease_token,lease_until)
 values(p_request_id,p_collection_id,auth.uid(),p_plan_id,p_lesson_index,p_question,md5(p_question),p_expected_revision,'processing',token,now()+interval '120 seconds')
 on conflict(id) do update set status='processing',lease_token=token,lease_until=now()+interval '120 seconds',attempts=public.learning_exchanges.attempts+1;
 return jsonb_build_object('conversation',public.get_learning_conversation(p_collection_id,p_plan_id,p_lesson_index),'lease_token',token);
end;$$;

create function public.finish_learning_conversation(p_request_id uuid,p_lease_token uuid,p_reply jsonb,p_model text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.learning_exchanges;n public.learning_plans;allowed jsonb;item jsonb;
begin
 select * into r from public.learning_exchanges where id=p_request_id and lease_token=p_lease_token and status='processing';
 if not found then return false;end if;
 select * into n from public.learning_plans where id=r.plan_id and user_id=r.user_id;
 perform public.learning_lock_members(r.user_id,n.source_members);
 perform 1 from public.sources s join public.learning_paths p on p.source_id=s.id where p.id=n.path_id and s.user_id=r.user_id for update of s;
 perform 1 from public.learning_collections where id=r.collection_id and user_id=r.user_id for update;
 select * into r from public.learning_exchanges where id=p_request_id and lease_token=p_lease_token and status='processing' for update;
 if not found or r.lease_until<=now() then return false;end if;
 if p_reply is null then update public.learning_exchanges set status='failed',lease_token=null,lease_until=null where id=r.id;return true;end if;
 if not public.learning_plan_current(n.id) or not exists(select 1 from public.learning_conversations where collection_id=r.collection_id and plan_id=r.plan_id and lesson_index=r.lesson_index and revision=r.base_revision) then return false;end if;
 allowed:=coalesce(n.content->'lessons'->r.lesson_index->'explanation'->'citation_ids','[]')||coalesce(n.content->'lessons'->r.lesson_index->'check'->'worked_answer'->'citation_ids','[]');
 if p_model is null or p_model not in ('gpt-6-luna','gpt-6.1-sol') or jsonb_typeof(p_reply)<>'object' or not (p_reply ?& array['text','citation_ids','gap']) or (p_reply-'text'-'citation_ids'-'gap')<>'{}' or jsonb_typeof(p_reply->'text')<>'string' or char_length(p_reply->>'text') not between 1 and 2000 or jsonb_typeof(p_reply->'citation_ids')<>'array' or jsonb_array_length(p_reply->'citation_ids')>10 or (jsonb_typeof(p_reply->'gap') not in ('string','null')) or char_length(p_reply->>'gap')>500 or (jsonb_array_length(p_reply->'citation_ids')=0 and coalesce(length(p_reply->>'gap'),0)=0) then raise exception using errcode='22023',message='Invalid tutor reply';end if;
 for item in select value from jsonb_array_elements(p_reply->'citation_ids') loop
  if jsonb_typeof(item)<>'string' or not (allowed ? (item#>>'{}')) or not exists(select 1 from jsonb_array_elements(n.source_references) ref where ref->>'id'=item#>>'{}') then raise exception using errcode='22023',message='Tutor citation unavailable';end if;
 end loop;
 update public.learning_exchanges set status='completed',reply=p_reply,model=p_model,completed_at=now(),lease_token=null,lease_until=null where id=r.id;
 update public.learning_conversations set revision=revision+1 where collection_id=r.collection_id and plan_id=r.plan_id and lesson_index=r.lesson_index;
 return true;
end;$$;
revoke execute on function public.get_learning_conversation(uuid,uuid,integer),public.request_learning_conversation(uuid,uuid,integer,uuid,text,bigint),public.finish_learning_conversation(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_learning_conversation(uuid,uuid,integer),public.request_learning_conversation(uuid,uuid,integer,uuid,text,bigint) to authenticated;
grant execute on function public.finish_learning_conversation(uuid,uuid,jsonb,text) to service_role;

create function public.clear_learning_conversation(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Collection not found';end if;
 result:=public.get_learning_conversation(p_collection_id,p_plan_id,p_lesson_index);
 if p_expected_revision is null or (result->>'revision')::bigint<>p_expected_revision then raise exception using errcode='40001',message='Conversation changed before clear';end if;
 insert into public.learning_conversations(collection_id,user_id,plan_id,lesson_index,revision) values(p_collection_id,auth.uid(),p_plan_id,p_lesson_index,1)
 on conflict(collection_id,plan_id,lesson_index) do update set revision=public.learning_conversations.revision+1;
 update public.learning_exchanges set status='cleared',question=null,reply=null,lease_token=null,lease_until=null
 where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and user_id=auth.uid();
 return public.get_learning_conversation(p_collection_id,p_plan_id,p_lesson_index);
end;$$;
revoke execute on function public.clear_learning_conversation(uuid,uuid,integer,bigint) from public,anon;
grant execute on function public.clear_learning_conversation(uuid,uuid,integer,bigint) to authenticated;

create function public.redact_removed_learning_conversation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.learning_exchanges e set reply=null,redacted=true
 from public.learning_plans n join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
 where e.plan_id=n.id and e.user_id=old.user_id and (p.original_source_id=old.id or exists(select 1 from jsonb_array_elements(n.source_members) m where m->>'source_id'=old.id::text));
 return old;
end;$$;
revoke execute on function public.redact_removed_learning_conversation() from public,anon,authenticated;
create trigger learning_conversation_source_removed before delete on public.sources for each row execute function public.redact_removed_learning_conversation();
commit;
