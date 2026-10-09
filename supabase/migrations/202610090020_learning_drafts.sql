-- Learner-authored unfinished work; never source evidence or submitted activity.
begin;
alter table public.learning_plans add constraint learning_plans_identity_owner unique(id,user_id);
create table public.learning_drafts (
 collection_id uuid not null,
 user_id uuid not null,
 plan_id uuid not null,
 lesson_index integer not null check(lesson_index between 0 and 3),
 kind text not null check(kind in ('answer','question')),
 text text not null default '' check(char_length(text)<=case when kind='answer' then 5000 else 2000 end),
 revision bigint not null check(revision>=1),
 save_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(collection_id,plan_id,lesson_index,kind),
 foreign key(collection_id,user_id) references public.learning_collections(id,user_id) on delete cascade,
 foreign key(plan_id,user_id) references public.learning_plans(id,user_id) on delete cascade
);
alter table public.learning_drafts enable row level security;
revoke all on public.learning_drafts from public,anon,authenticated;
grant select on public.learning_drafts to authenticated;
create policy learning_drafts_owned on public.learning_drafts for select to authenticated using(user_id=(select auth.uid()));

create function public.get_learning_draft(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.learning_plans;d public.learning_drafts;
begin
 select n0.* into n from public.learning_plans n0 join public.learning_paths p on p.id=n0.path_id and p.user_id=n0.user_id
 join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
 where c.id=p_collection_id and n0.id=p_plan_id and n0.user_id=auth.uid() and n0.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='Collection lesson not found';end if;
 if p_kind is null or p_kind not in ('answer','question') or p_lesson_index is null or p_lesson_index<0 or p_lesson_index>=jsonb_array_length(n.content->'lessons') then
  raise exception using errcode='22023',message='Invalid lesson draft';end if;
 select * into d from public.learning_drafts where collection_id=p_collection_id and plan_id=n.id and lesson_index=p_lesson_index and kind=p_kind and user_id=auth.uid();
 return jsonb_build_object('user_id',auth.uid(),'collection_id',p_collection_id,'plan_id',n.id,'lesson_index',p_lesson_index,'kind',p_kind,'scope','lesson',
  'source_version',n.source_version,'evidence_current',public.learning_plan_current(n.id),'text',coalesce(d.text,''),'revision',coalesce(d.revision,0),'save_id',d.save_id,'updated_at',d.updated_at);
end;$$;

create function public.save_learning_draft(p_collection_id uuid,p_plan_id uuid,p_lesson_index integer,p_kind text,p_text text,p_expected_revision bigint,p_save_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.learning_drafts;
begin
 -- Serialize first creation as well as updates; no cursor or activity is modified.
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Collection not found';end if;
 perform public.get_learning_draft(p_collection_id,p_plan_id,p_lesson_index,p_kind);
 if p_text is null or char_length(p_text)>(case when p_kind='answer' then 5000 else 2000 end) or p_expected_revision is null or p_expected_revision<0 or p_save_id is null then
  raise exception using errcode='22023',message='Invalid draft save';end if;
 select * into d from public.learning_drafts where collection_id=p_collection_id and plan_id=p_plan_id and lesson_index=p_lesson_index and kind=p_kind and user_id=auth.uid();
 if d.save_id=p_save_id then
  if d.text<>p_text then raise exception using errcode='40001',message='Draft retry changed';end if;
  return public.get_learning_draft(p_collection_id,p_plan_id,p_lesson_index,p_kind);
 end if;
 if coalesce(d.revision,0)<>p_expected_revision then raise exception using errcode='40001',message='Draft changed in another tab';end if;
 insert into public.learning_drafts(collection_id,user_id,plan_id,lesson_index,kind,text,revision,save_id)
 values(p_collection_id,auth.uid(),p_plan_id,p_lesson_index,p_kind,p_text,p_expected_revision+1,p_save_id)
 on conflict(collection_id,plan_id,lesson_index,kind) do update set text=excluded.text,revision=excluded.revision,save_id=excluded.save_id,updated_at=now();
 return public.get_learning_draft(p_collection_id,p_plan_id,p_lesson_index,p_kind);
end;$$;
revoke execute on function public.get_learning_draft(uuid,uuid,integer,text),public.save_learning_draft(uuid,uuid,integer,text,text,bigint,uuid) from public,anon;
grant execute on function public.get_learning_draft(uuid,uuid,integer,text),public.save_learning_draft(uuid,uuid,integer,text,text,bigint,uuid) to authenticated;
commit;
