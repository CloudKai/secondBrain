-- Path quiz v1. One quiz per confirmed learning-plan revision, a private answer key,
-- attempts with per-question results, and a durable per-user daily usage counter.
-- Browsers only read key-free rows; every write happens inside a definer function.
-- Spec: docs/planning/path-quiz-spec.md (section 4 as amended by section 20).
begin;

-- Created before quiz_questions because that table's CHECK uses it (dropped last on rollback).
create function public.quiz_options_valid(p_kind text,p_options jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare v_opt jsonb;v_ids text[]:='{}';v_id text;v_count integer;
begin
 if p_kind is null or p_options is null or jsonb_typeof(p_options) is distinct from 'array' then return false;end if;
 v_count:=jsonb_array_length(p_options);
 if v_count<>case p_kind when 'single_choice' then 4 when 'true_false' then 2 when 'multi_select' then 5 when 'short_answer' then 0 else -1 end then return false;end if;
 for v_opt in select value from jsonb_array_elements(p_options) loop
  if jsonb_typeof(v_opt) is distinct from 'object' then return false;end if;
  if (select count(*) from jsonb_object_keys(v_opt))<>2 or not (v_opt ?& array['id','text']) then return false;end if;
  if jsonb_typeof(v_opt->'id') is distinct from 'string' or jsonb_typeof(v_opt->'text') is distinct from 'string' then return false;end if;
  v_id:=v_opt->>'id';
  if v_id !~ '^(o[1-5]|true|false)$' or char_length(v_opt->>'text') not between 1 and 200 or v_id=any(v_ids) then return false;end if;
  v_ids:=v_ids||v_id;
 end loop;
 if p_kind='true_false' then return p_options='[{"id":"true","text":"True"},{"id":"false","text":"False"}]'::jsonb;end if;
 if p_kind in ('single_choice','multi_select') then return not (v_ids && array['true','false']);end if;
 return true;
end;$$;

create table public.quizzes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 regenerate boolean not null default false,
 plan_id uuid not null,
 status text not null check(status in ('generating','ready','failed')),
 is_current boolean not null default false,
 source_version integer not null check(source_version between 1 and 20),
 policy_version text not null default 'quiz_v1' check(policy_version='quiz_v1'),
 model text check(model is null or model ~ '^[A-Za-z0-9._:-]{1,64}$'),
 fallback_used boolean not null default false,
 question_count integer check(question_count is null or question_count between 4 and 10),
 outcomes jsonb not null default '[]' check(jsonb_typeof(outcomes)='array' and jsonb_array_length(outcomes)<=4),
 tokens_in integer check(tokens_in is null or tokens_in>=0),
 tokens_out integer check(tokens_out is null or tokens_out>=0),
 lease_token uuid,
 lease_until timestamptz,
 attempts integer not null default 1 check(attempts between 1 and 3),
 charge_state text check(charge_state is null or charge_state in ('charged','refunded')),
 charged_on date,
 charged_lease uuid,
 error_code text check(error_code is null or char_length(error_code)<=40),
 redacted_at timestamptz,
 created_at timestamptz not null default now(),
 generated_at timestamptz,
 check(not is_current or status='ready'),
 check(status<>'ready' or (generated_at is not null and model is not null and question_count is not null)),
 unique(user_id,request_id),
 unique(id,user_id),
 unique(id,plan_id,user_id),
 foreign key(plan_id,user_id) references public.learning_plans(id,user_id) on delete cascade
);
create unique index quizzes_one_current on public.quizzes(plan_id) where is_current;
create unique index quizzes_one_generating on public.quizzes(plan_id) where status='generating';
create index quizzes_plan_created on public.quizzes(user_id,plan_id,created_at desc);

create table public.quiz_questions (
 id uuid primary key default gen_random_uuid(),
 quiz_id uuid not null,
 user_id uuid not null,
 position integer not null check(position between 0 and 9),
 kind text not null check(kind in ('single_choice','true_false','multi_select','short_answer')),
 prompt text check(prompt is null or char_length(prompt) between 1 and 400),
 options jsonb check(options is null or public.quiz_options_valid(kind,options)),
 outcome_index integer not null check(outcome_index between 0 and 3),
 outcome_title text not null check(char_length(outcome_title) between 1 and 500),
 redacted boolean not null default false,
 check(redacted or (prompt is not null and options is not null)),
 unique(quiz_id,position),
 unique(id,quiz_id,user_id),
 foreign key(quiz_id,user_id) references public.quizzes(id,user_id) on delete cascade
);

-- The answer key lives apart from the readable question rows and has no grants and no policy.
create table public.quiz_question_keys (
 question_id uuid primary key,
 quiz_id uuid not null,
 user_id uuid not null,
 correct_option_ids text[],
 explanation text not null check(char_length(explanation) between 1 and 800),
 citation_ids text[] not null check(cardinality(citation_ids) between 1 and 3),
 criteria jsonb check(criteria is null or (jsonb_typeof(criteria)='array' and jsonb_array_length(criteria) between 2 and 4)),
 model_answer text check(model_answer is null or char_length(model_answer)<=800),
 foreign key(question_id,quiz_id,user_id) references public.quiz_questions(id,quiz_id,user_id) on delete cascade
);

create table public.quiz_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_attempt_id uuid not null,
 quiz_id uuid not null,
 plan_id uuid not null,
 status text not null check(status in ('grading','graded')),
 answers_hash text not null check(answers_hash ~ '^[a-f0-9]{64}$'),
 deterministic_total integer not null check(deterministic_total between 3 and 10),
 correct_count integer,
 short_answer_total integer not null check(short_answer_total between 0 and 2),
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 graded_at timestamptz,
 check(correct_count is null or correct_count between 0 and deterministic_total),
 check((status='graded')=(correct_count is not null and graded_at is not null)),
 unique(user_id,client_attempt_id),
 unique(id,quiz_id,user_id),
 foreign key(quiz_id,plan_id,user_id) references public.quizzes(id,plan_id,user_id) on delete cascade
);
create index quiz_attempts_quiz on public.quiz_attempts(user_id,quiz_id,created_at desc);

-- One row per (attempt, question): the per-question result store.
create table public.quiz_attempt_answers (
 attempt_id uuid not null,
 question_id uuid not null,
 user_id uuid not null,
 quiz_id uuid not null,
 kind text not null check(kind in ('single_choice','true_false','multi_select','short_answer')),
 outcome_index integer not null check(outcome_index between 0 and 3),
 answer jsonb not null check(jsonb_typeof(answer)='object' and char_length(coalesce(answer->>'text',''))<=5000 and octet_length(answer::text)<=24000),
 result text check(result is null or result in ('correct','partly_correct','incorrect','unanswered','addressed','needs_review','uncertain','unavailable')),
 signal text check(signal is null or signal in ('positive','negative','neutral')),
 grading_source text check(grading_source is null or grading_source in ('deterministic','model')),
 grading_state text not null default 'not_applicable' check(grading_state in ('not_applicable','pending','graded','unavailable')),
 unavailable_reason text check(unavailable_reason is null or unavailable_reason in ('limit','provider','invalid_output','setup_required','timeout')),
 feedback jsonb check(feedback is null or octet_length(feedback::text)<=16384),
 model text check(model is null or model ~ '^[A-Za-z0-9._:-]{1,64}$'),
 reveal jsonb check(reveal is null or octet_length(reveal::text)<=16384),
 redacted boolean not null default false,
 grading_attempts integer not null default 0 check(grading_attempts between 0 and 3),
 grading_lease_token uuid,
 grading_lease_until timestamptz,
 grading_charge_state text check(grading_charge_state is null or grading_charge_state in ('charged','refunded')),
 grading_charged_on date,
 grading_charged_lease uuid,
 graded_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(attempt_id,question_id),
 -- A pending short answer carries its reveal (criteria, model answer) before it has a result.
 check(reveal is null or result is not null or grading_state='pending'),
 foreign key(attempt_id,quiz_id,user_id) references public.quiz_attempts(id,quiz_id,user_id) on delete cascade,
 foreign key(question_id,quiz_id,user_id) references public.quiz_questions(id,quiz_id,user_id) on delete cascade
);

create table public.quiz_usage_counters (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null,
 kind text not null check(kind in ('generation','grading')),
 count integer not null check(count>=0),
 updated_at timestamptz not null default now(),
 primary key(user_id,usage_date,kind)
);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.quiz_usage_counters enable row level security;
revoke all on public.quizzes,public.quiz_questions,public.quiz_question_keys,public.quiz_attempts,public.quiz_attempt_answers,public.quiz_usage_counters from public,anon,authenticated;
grant select on public.quizzes,public.quiz_questions,public.quiz_attempts,public.quiz_attempt_answers to authenticated;
create policy quizzes_owned on public.quizzes for select to authenticated using(user_id=(select auth.uid()));
create policy quiz_questions_owned on public.quiz_questions for select to authenticated using(user_id=(select auth.uid()));
create policy quiz_attempts_owned on public.quiz_attempts for select to authenticated using(user_id=(select auth.uid()));
create policy quiz_attempt_answers_owned on public.quiz_attempt_answers for select to authenticated using(user_id=(select auth.uid()));

-- Atomic increment-and-check. Reached only from charge_quiz_generation and charge_quiz_grading.
create function public.quiz_consume_usage(p_user_id uuid,p_kind text,p_limit integer,p_amount integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_date date:=(now() at time zone 'utc')::date;v_count integer;
begin
 if p_user_id is null or p_kind is null or p_kind not in ('generation','grading') or p_limit is null or p_limit not between 1 and 1000 or p_amount is null or p_amount not between 1 and 10 then
  raise exception using errcode='22023',message='quiz_usage_invalid';end if;
 if p_amount<=p_limit then
  insert into public.quiz_usage_counters as c(user_id,usage_date,kind,count) values(p_user_id,v_date,p_kind,p_amount)
  on conflict(user_id,usage_date,kind) do update set count=c.count+p_amount,updated_at=now() where c.count+p_amount<=p_limit
  returning c.count into v_count;
 end if;
 if v_count is null then
  select c.count into v_count from public.quiz_usage_counters c where c.user_id=p_user_id and c.usage_date=v_date and c.kind=p_kind;
  return jsonb_build_object('allowed',false,'used',coalesce(v_count,0),'limit',p_limit,'usage_date',v_date,
   'resets_at',to_char((v_date+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
 end if;
 return jsonb_build_object('allowed',true,'used',v_count,'limit',p_limit,'usage_date',v_date,
  'resets_at',to_char((v_date+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
end;$$;

create function public.quiz_release_usage(p_user_id uuid,p_usage_date date,p_kind text,p_amount integer default 1) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.quiz_usage_counters c set count=greatest(c.count-p_amount,0),updated_at=now()
 where c.user_id=p_user_id and c.usage_date=p_usage_date and c.kind=p_kind;
end;$$;

-- Shared lease rules for an attempt (functions submit_quiz_attempt and claim_quiz_attempt_grading).
create function public.quiz_lease_attempt(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_att public.quiz_attempts;v_token uuid:=gen_random_uuid();
begin
 select * into v_att from public.quiz_attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 if v_att.status='graded' then return jsonb_build_object('attempt_id',v_att.id,'lease_token',null,'replay',true);end if;
 if v_att.lease_until>now() then raise exception using errcode='55P03',message='quiz_attempt_in_progress';end if;
 update public.quiz_attempts set lease_token=v_token,lease_until=now()+interval '60 seconds' where id=v_att.id;
 return jsonb_build_object('attempt_id',v_att.id,'lease_token',v_token,'replay',false);
end;$$;

-- 1. Quiz state: plan flags, current ready quiz (key-free), attempts, own usage. Never reads quiz_question_keys.
create function public.get_quiz_state(p_collection_id uuid,p_plan_id uuid,p_include_material boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;v_path public.learning_paths;v_quiz public.quizzes;v_has boolean;v_gen boolean;v_current boolean;
 v_quiz_json jsonb;v_attempts jsonb;v_used integer;v_date date:=(now() at time zone 'utc')::date;v_result jsonb;
begin
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_path from public.learning_paths where id=v_plan.path_id and user_id=auth.uid();
 v_current:=public.learning_plan_current(v_plan.id);
 select * into v_quiz from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and is_current;
 v_has:=found;
 v_gen:=exists(select 1 from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and status='generating' and lease_until>now());
 if v_has then
  v_quiz_json:=jsonb_build_object('id',v_quiz.id,'generated_at',v_quiz.generated_at,'question_count',v_quiz.question_count,
   'outcomes',v_quiz.outcomes,'redacted',v_quiz.redacted_at is not null,'source_version',v_quiz.source_version,
   'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'kind',q.kind,'prompt',q.prompt,'options',q.options,
     'outcome_index',q.outcome_index,'outcome_title',q.outcome_title,'redacted',q.redacted) order by q.position),'[]'::jsonb)
     from public.quiz_questions q where q.quiz_id=v_quiz.id and q.user_id=auth.uid()));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('attempt_id',t.id,'quiz_id',t.quiz_id,'quiz_is_current',t.is_current,'status',t.status,
   'submitted_at',t.created_at,'correct',t.correct_count,'total',t.deterministic_total,'short_answers_total',t.short_answer_total,
   'short_answers_pending',t.pending) order by t.created_at desc,t.id),'[]'::jsonb) into v_attempts
 from (select a.*,z.is_current,(select count(*) from public.quiz_attempt_answers x where x.attempt_id=a.id and x.grading_state='pending') pending
   from public.quiz_attempts a join public.quizzes z on z.id=a.quiz_id and z.user_id=a.user_id
   where a.plan_id=v_plan.id and a.user_id=auth.uid() order by a.created_at desc,a.id limit 20) t;
 select c.count into v_used from public.quiz_usage_counters c where c.user_id=auth.uid() and c.usage_date=v_date and c.kind='generation';
 v_result:=jsonb_build_object('plan',jsonb_build_object('is_active',v_path.active_plan_id is not distinct from v_plan.id,'evidence_current',v_current,
   'needs_review',not v_current,'source_version',v_plan.source_version),
  'generating',v_gen,'quiz',v_quiz_json,'attempts',v_attempts,
  'usage',jsonb_build_object('generation_used',coalesce(v_used,0),'resets_at',to_char((v_date+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 if p_include_material is true or (not v_has and not v_gen) then
  v_result:=v_result||jsonb_build_object('material',jsonb_build_object('content',v_plan.content,'source_references',v_plan.source_references));
 end if;
 return v_result;
end;$$;

-- 2. Claim a generation lease. Replay lookup comes first; only a new key checks the plan is active and current.
create function public.request_quiz_generation(p_collection_id uuid,p_plan_id uuid,p_request_id uuid,p_regenerate boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;v_path public.learning_paths;v_row public.quizzes;v_cur public.quizzes;v_exists boolean;
 v_token uuid:=gen_random_uuid();v_id uuid;v_regen boolean:=coalesce(p_regenerate,false);v_today date:=(now() at time zone 'utc')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_row from public.quizzes where user_id=auth.uid() and request_id=p_request_id for update;
 v_exists:=found;
 if v_exists then
  if v_row.plan_id<>v_plan.id or v_row.regenerate<>v_regen then raise exception using errcode='40001',message='quiz_request_changed';end if;
  if v_row.status='ready' then return jsonb_build_object('quiz_id',v_row.id,'lease_token',null,'replay',true);end if;
  if v_row.status='generating' and v_row.lease_until>now() then raise exception using errcode='55P03',message='quiz_generation_in_progress';end if;
 end if;
 select * into v_path from public.learning_paths where id=v_plan.path_id and user_id=auth.uid();
 if v_path.active_plan_id is distinct from v_plan.id then raise exception using errcode='40001',message='quiz_plan_not_current';end if;
 if not public.learning_plan_current(v_plan.id) then raise exception using errcode='40001',message='quiz_evidence_changed';end if;
 if v_exists then
  if v_row.attempts>=3 then raise exception using errcode='54000',message='quiz_request_exhausted';end if;
 elsif not v_regen then
  select * into v_cur from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and is_current;
  if found then return jsonb_build_object('quiz_id',v_cur.id,'lease_token',null,'replay',true);end if;
 end if;
 if exists(select 1 from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and status='generating' and lease_until>now() and id is distinct from v_row.id) then
  raise exception using errcode='55P03',message='quiz_generation_in_progress';end if;
 update public.quizzes set status='failed',lease_token=null,lease_until=null,error_code='lease_expired'
  where plan_id=v_plan.id and user_id=auth.uid() and status='generating' and lease_until<=now() and id is distinct from v_row.id;
 delete from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and status='failed' and created_at<now()-interval '24 hours' and id is distinct from v_row.id;
 if not v_exists then
  if (select count(*) from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and status='ready')>=20 then
   raise exception using errcode='54000',message='quiz_plan_cap_reached';end if;
  if (select count(*) from public.quizzes where plan_id=v_plan.id and user_id=auth.uid() and status='failed' and (created_at at time zone 'utc')::date=v_today)>=10 then
   raise exception using errcode='54000',message='quiz_generation_attempts_capped';end if;
  insert into public.quizzes(user_id,request_id,regenerate,plan_id,status,source_version,lease_token,lease_until)
  values(auth.uid(),p_request_id,v_regen,v_plan.id,'generating',v_plan.source_version,v_token,now()+interval '150 seconds') returning id into v_id;
 else
  update public.quizzes set status='generating',lease_token=v_token,lease_until=now()+interval '150 seconds',attempts=attempts+1,error_code=null where id=v_row.id;
  v_id:=v_row.id;
 end if;
 return jsonb_build_object('quiz_id',v_id,'lease_token',v_token,'replay',false);
end;$$;

-- 3. Store an attempt and its answers. Replay lookup first; the stored answer is rebuilt from validated fields only.
create function public.submit_quiz_attempt(p_collection_id uuid,p_plan_id uuid,p_quiz_id uuid,p_attempt_key uuid,p_answers jsonb,p_answers_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;v_quiz public.quizzes;v_att public.quiz_attempts;v_q public.quiz_questions;
 v_item jsonb;v_in jsonb;v_ids text[];v_text text;v_answer jsonb;v_token uuid:=gen_random_uuid();v_aid uuid;v_det integer;v_short integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_quiz from public.quizzes where id=p_quiz_id and plan_id=v_plan.id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_att from public.quiz_attempts where user_id=auth.uid() and client_attempt_id=p_attempt_key for update;
 if found then
  if v_att.quiz_id<>v_quiz.id or v_att.answers_hash is distinct from p_answers_hash then raise exception using errcode='40001',message='quiz_attempt_conflict';end if;
  return public.quiz_lease_attempt(v_att.id);
 end if;
 if v_quiz.status<>'ready' then raise exception using errcode='P0002',message='quiz_not_found';end if;
 if v_quiz.redacted_at is not null or not public.learning_plan_current(v_plan.id) then raise exception using errcode='40001',message='quiz_evidence_changed';end if;
 if p_answers is null or jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)>10 or p_answers_hash is null or p_answers_hash !~ '^[a-f0-9]{64}$' then
  raise exception using errcode='22023',message='quiz_answer_invalid';end if;
 if (select count(*) from public.quiz_attempts where quiz_id=v_quiz.id and user_id=auth.uid())>=20 then
  raise exception using errcode='54000',message='quiz_attempt_limit_reached';end if;
 if exists(select 1 from jsonb_array_elements(p_answers) as e(value) where jsonb_typeof(e.value) is distinct from 'object' or jsonb_typeof(e.value->'question_id') is distinct from 'string') then
  raise exception using errcode='22023',message='quiz_answer_invalid';end if;
 if (select count(*) from jsonb_array_elements(p_answers) as e(value) join public.quiz_questions q on q.quiz_id=v_quiz.id and q.id::text=lower(e.value->>'question_id'))<>jsonb_array_length(p_answers)
  or (select count(distinct lower(e.value->>'question_id')) from jsonb_array_elements(p_answers) as e(value))<>jsonb_array_length(p_answers) then
  raise exception using errcode='22023',message='quiz_answer_invalid';end if;
 select count(*) filter (where kind<>'short_answer'),count(*) filter (where kind='short_answer') into v_det,v_short from public.quiz_questions where quiz_id=v_quiz.id;
 insert into public.quiz_attempts(user_id,client_attempt_id,quiz_id,plan_id,status,answers_hash,deterministic_total,short_answer_total,lease_token,lease_until)
 values(auth.uid(),p_attempt_key,v_quiz.id,v_plan.id,'grading',p_answers_hash,v_det,v_short,v_token,now()+interval '60 seconds')
 on conflict(user_id,client_attempt_id) do nothing returning id into v_aid;
 if v_aid is null then
  select * into v_att from public.quiz_attempts where user_id=auth.uid() and client_attempt_id=p_attempt_key for update;
  return public.quiz_lease_attempt(v_att.id);
 end if;
 for v_q in select * from public.quiz_questions where quiz_id=v_quiz.id order by position loop
  select e.value into v_item from jsonb_array_elements(p_answers) as e(value) where lower(e.value->>'question_id')=v_q.id::text;
  v_in:='{}'::jsonb;
  if v_item is not null then
   if v_item->>'kind' is distinct from v_q.kind or jsonb_typeof(coalesce(v_item->'answer','{}'::jsonb)) is distinct from 'object' then
    raise exception using errcode='22023',message='quiz_answer_invalid';end if;
   v_in:=coalesce(v_item->'answer','{}'::jsonb);
  end if;
  if v_q.kind='short_answer' then
   v_text:=null;
   if v_in ? 'text' then
    if jsonb_typeof(v_in->'text') is distinct from 'string' then raise exception using errcode='22023',message='quiz_answer_invalid';end if;
    v_text:=v_in->>'text';
    if char_length(v_text)>5000 then raise exception using errcode='22023',message='quiz_answer_invalid';end if;
   end if;
   v_answer:=case when v_text is null or btrim(v_text,E' \t\r\n')='' then '{}'::jsonb else jsonb_build_object('text',v_text) end;
  else
   v_ids:='{}';
   if v_in ? 'option_ids' then
    if jsonb_typeof(v_in->'option_ids') is distinct from 'array'
     or exists(select 1 from jsonb_array_elements(v_in->'option_ids') as x(value) where jsonb_typeof(x.value) is distinct from 'string') then
     raise exception using errcode='22023',message='quiz_answer_invalid';end if;
    v_ids:=array(select distinct y from jsonb_array_elements_text(v_in->'option_ids') as x(y) order by y);
   end if;
   if exists(select 1 from unnest(v_ids) as u(id) where not exists(select 1 from jsonb_array_elements(v_q.options) as o(value) where o.value->>'id'=u.id))
    or (v_q.kind<>'multi_select' and cardinality(v_ids)>1) then
    raise exception using errcode='22023',message='quiz_answer_invalid';end if;
   v_answer:=case when cardinality(v_ids)=0 then '{}'::jsonb else jsonb_build_object('option_ids',to_jsonb(v_ids)) end;
  end if;
  insert into public.quiz_attempt_answers(attempt_id,question_id,user_id,quiz_id,kind,outcome_index,answer)
  values(v_aid,v_q.id,auth.uid(),v_quiz.id,v_q.kind,v_q.outcome_index,v_answer);
 end loop;
 return jsonb_build_object('attempt_id',v_aid,'lease_token',v_token,'replay',false);
end;$$;

-- 4. Self-heal an attempt stuck in grading (expired lease).
create function public.claim_quiz_attempt_grading(p_collection_id uuid,p_plan_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 perform 1 from public.quiz_attempts where id=p_attempt_id and plan_id=v_plan.id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 return public.quiz_lease_attempt(p_attempt_id);
end;$$;

-- 5. Read an attempt. result, signal, feedback and reveal are returned only once the attempt is graded.
create function public.get_quiz_attempt(p_collection_id uuid,p_plan_id uuid,p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;v_att public.quiz_attempts;v_current boolean;v_answers jsonb;v_used integer;v_date date:=(now() at time zone 'utc')::date;
begin
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_att from public.quiz_attempts where id=p_attempt_id and plan_id=v_plan.id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select z.is_current into v_current from public.quizzes z where z.id=v_att.quiz_id and z.user_id=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('question_id',x.question_id,'position',q.position,'kind',x.kind,'outcome_index',x.outcome_index,
   'outcome_title',q.outcome_title,'prompt',q.prompt,'options',q.options,'answer',x.answer,
   'result',case when v_att.status='graded' then x.result end,'signal',case when v_att.status='graded' then x.signal end,
   'grading_state',x.grading_state,'unavailable_reason',x.unavailable_reason,'grading_attempts',x.grading_attempts,
   'feedback',case when v_att.status='graded' then x.feedback end,'model',case when v_att.status='graded' then x.model end,
   'reveal',case when v_att.status='graded' then x.reveal end,'redacted',q.redacted or x.redacted) order by q.position),'[]'::jsonb) into v_answers
 from public.quiz_attempt_answers x join public.quiz_questions q on q.id=x.question_id and q.quiz_id=x.quiz_id and q.user_id=x.user_id
 where x.attempt_id=v_att.id and x.user_id=auth.uid();
 select c.count into v_used from public.quiz_usage_counters c where c.user_id=auth.uid() and c.usage_date=v_date and c.kind='grading';
 return jsonb_build_object('attempt',jsonb_build_object('id',v_att.id,'quiz_id',v_att.quiz_id,'plan_id',v_att.plan_id,'status',v_att.status,
   'submitted_at',v_att.created_at,'graded_at',v_att.graded_at,'correct',v_att.correct_count,'total',v_att.deterministic_total,
   'short_answers_total',v_att.short_answer_total,'lease_live',coalesce(v_att.lease_until>now(),false),'quiz_is_current',coalesce(v_current,false)),
  'answers',v_answers,
  'grading_used',coalesce(v_used,0),
  'grading_resets_at',to_char((v_date+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
end;$$;

-- 6. Admit one short-answer feedback request. Only function 13 counts a provider-bound try.
create function public.claim_quiz_short_answer(p_collection_id uuid,p_plan_id uuid,p_attempt_id uuid,p_question_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_plan public.learning_plans;v_att public.quiz_attempts;v_ans public.quiz_attempt_answers;v_token uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.learning_collections where id=p_collection_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select n.* into v_plan from public.learning_plans n
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  join public.learning_collections c on c.id=p.collection_id and c.user_id=p.user_id
  where c.id=p_collection_id and n.id=p_plan_id and n.user_id=auth.uid() and n.confirmed_at is not null;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_att from public.quiz_attempts where id=p_attempt_id and plan_id=v_plan.id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 select * into v_ans from public.quiz_attempt_answers where attempt_id=v_att.id and question_id=p_question_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='quiz_not_found';end if;
 if v_att.status<>'graded' then raise exception using errcode='55P03',message='quiz_attempt_in_progress';end if;
 if v_ans.kind<>'short_answer' or v_ans.redacted or coalesce(v_ans.answer->>'text','')='' then
  raise exception using errcode='22023',message='quiz_answer_invalid';end if;
 if v_ans.grading_state='graded' then return jsonb_build_object('attempt_id',v_att.id,'question_id',v_ans.question_id,'lease_token',null,'grading_state','graded');end if;
 if v_ans.grading_lease_until>now() then raise exception using errcode='55P03',message='quiz_grading_busy';end if;
 if v_ans.grading_state='unavailable' and v_ans.unavailable_reason is distinct from 'limit' and v_ans.grading_attempts>=3 then
  raise exception using errcode='54000',message='quiz_grading_exhausted';end if;
 update public.quiz_attempt_answers set grading_lease_token=v_token,grading_lease_until=now()+interval '90 seconds' where attempt_id=v_att.id and question_id=v_ans.question_id;
 return jsonb_build_object('attempt_id',v_att.id,'question_id',v_ans.question_id,'lease_token',v_token,'grading_state',v_ans.grading_state);
end;$$;

-- 7. Charge one generation under a live lease (service role). Idempotent within a lease.
create function public.charge_quiz_generation(p_quiz_id uuid,p_lease_token uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_q public.quizzes;v_res jsonb;v_used integer;
begin
 select * into v_q from public.quizzes where id=p_quiz_id for update;
 if not found or v_q.status<>'generating' or v_q.lease_token is distinct from p_lease_token or v_q.lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 if v_q.charge_state='charged' and v_q.charged_lease=p_lease_token then
  select c.count into v_used from public.quiz_usage_counters c where c.user_id=v_q.user_id and c.usage_date=v_q.charged_on and c.kind='generation';
  return jsonb_build_object('allowed',true,'used',coalesce(v_used,0),'limit',p_limit,'usage_date',v_q.charged_on,
   'resets_at',to_char((v_q.charged_on+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
 end if;
 v_res:=public.quiz_consume_usage(v_q.user_id,'generation',p_limit,1);
 if (v_res->>'allowed')::boolean then
  update public.quizzes set charge_state='charged',charged_on=(v_res->>'usage_date')::date,charged_lease=p_lease_token where id=v_q.id;
 end if;
 return v_res;
end;$$;

-- 8. Validate and store a generated quiz (service role). Returns false when the plan is stale.
create function public.finish_quiz_generation(p_quiz_id uuid,p_lease_token uuid,p_quiz jsonb,p_model text,p_fallback_used boolean,p_tokens_in integer,p_tokens_out integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_q public.quizzes;v_plan public.learning_plans;v_path public.learning_paths;v_lessons jsonb;v_lesson jsonb;v_cited jsonb;
 v_n integer;v_i integer;v_oi integer;v_qj jsonb;v_kj jsonb;v_kind text;v_qid uuid;v_correct text[];v_cid text;v_opts jsonb;
begin
 select * into v_q from public.quizzes where id=p_quiz_id;
 if not found then raise exception using errcode='40001',message='quiz_lease_lost';end if;
 select * into v_plan from public.learning_plans where id=v_q.plan_id and user_id=v_q.user_id;
 -- Same lock order as the other finish functions: learner, source rows, collection, then the quiz row.
 perform public.learning_lock_members(v_q.user_id,v_plan.source_members);
 perform 1 from public.sources s join public.learning_paths p on p.source_id=s.id and p.user_id=s.user_id where p.id=v_plan.path_id and s.user_id=v_q.user_id for update of s;
 perform 1 from public.learning_collections c join public.learning_paths p on p.collection_id=c.id and p.user_id=c.user_id where p.id=v_plan.path_id and c.user_id=v_q.user_id for update of c;
 select * into v_q from public.quizzes where id=p_quiz_id for update;
 if not found or v_q.status<>'generating' or v_q.lease_token is distinct from p_lease_token or v_q.lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 select * into v_path from public.learning_paths where id=v_plan.path_id and user_id=v_q.user_id;
 if not public.learning_plan_current(v_plan.id) or v_path.active_plan_id is distinct from v_plan.id then return false;end if;
 if p_model is null or p_model !~ '^[A-Za-z0-9._:-]{1,64}$' or p_fallback_used is null or coalesce(p_tokens_in,0)<0 or coalesce(p_tokens_out,0)<0
  or jsonb_typeof(p_quiz) is distinct from 'object' then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if (p_quiz-'questions'-'key'-'outcomes')<>'{}'::jsonb or jsonb_typeof(p_quiz->'questions') is distinct from 'array' or jsonb_typeof(p_quiz->'key') is distinct from 'array'
  or jsonb_typeof(p_quiz->'outcomes') is distinct from 'array' then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 v_n:=jsonb_array_length(p_quiz->'questions');
 v_lessons:=v_plan.content->'lessons';
 if v_n not between 4 and 10 or jsonb_array_length(p_quiz->'key')<>v_n or jsonb_array_length(p_quiz->'outcomes') not between 1 and 4 or jsonb_typeof(v_lessons) is distinct from 'array' then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 -- Outcome snapshot: {index,title}, index within the plan's lessons, unique.
 if exists(select 1 from jsonb_array_elements(p_quiz->'outcomes') as o(value) where jsonb_typeof(o.value) is distinct from 'object') then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if exists(select 1 from jsonb_array_elements(p_quiz->'outcomes') as o(value) where (o.value-'index'-'title')<>'{}'::jsonb
   or jsonb_typeof(o.value->'index') is distinct from 'number' or (o.value->>'index') !~ '^[0-3]$'
   or jsonb_typeof(o.value->'title') is distinct from 'string' or char_length(o.value->>'title') not between 1 and 500) then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if (select count(distinct o.value->>'index') from jsonb_array_elements(p_quiz->'outcomes') as o(value))<>jsonb_array_length(p_quiz->'outcomes')
  or exists(select 1 from jsonb_array_elements(p_quiz->'outcomes') as o(value) where (o.value->>'index')::integer>=jsonb_array_length(v_lessons)) then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 -- Question and key entries: objects joined by a contiguous position 0..n-1.
 if exists(select 1 from jsonb_array_elements(p_quiz->'questions') as e(value) where jsonb_typeof(e.value) is distinct from 'object')
  or exists(select 1 from jsonb_array_elements(p_quiz->'key') as e(value) where jsonb_typeof(e.value) is distinct from 'object') then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if exists(select 1 from jsonb_array_elements(p_quiz->'questions') as e(value) where jsonb_typeof(e.value->'position') is distinct from 'number' or (e.value->>'position') !~ '^[0-9]$')
  or exists(select 1 from jsonb_array_elements(p_quiz->'key') as e(value) where jsonb_typeof(e.value->'position') is distinct from 'number' or (e.value->>'position') !~ '^[0-9]$') then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if (select count(distinct (e.value->>'position')::integer) from jsonb_array_elements(p_quiz->'questions') as e(value))<>v_n
  or (select max((e.value->>'position')::integer) from jsonb_array_elements(p_quiz->'questions') as e(value))<>v_n-1
  or (select count(distinct (e.value->>'position')::integer) from jsonb_array_elements(p_quiz->'key') as e(value))<>v_n
  or (select max((e.value->>'position')::integer) from jsonb_array_elements(p_quiz->'key') as e(value))<>v_n-1 then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 for v_i in 0..v_n-1 loop
  select e.value into v_qj from jsonb_array_elements(p_quiz->'questions') as e(value) where (e.value->>'position')::integer=v_i;
  select e.value into v_kj from jsonb_array_elements(p_quiz->'key') as e(value) where (e.value->>'position')::integer=v_i;
  v_kind:=v_qj->>'kind';v_opts:=v_qj->'options';
  if (v_qj-'position'-'kind'-'prompt'-'options'-'outcome_index'-'outcome_title')<>'{}'::jsonb
   or (v_kj-'position'-'correct_option_ids'-'explanation'-'citation_ids'-'criteria'-'model_answer')<>'{}'::jsonb
   or v_kind is null or v_kind not in ('single_choice','true_false','multi_select','short_answer')
   or jsonb_typeof(v_qj->'prompt') is distinct from 'string' or char_length(v_qj->>'prompt') not between 1 and 400
   or not public.quiz_options_valid(v_kind,v_opts)
   or jsonb_typeof(v_qj->'outcome_index') is distinct from 'number' or (v_qj->>'outcome_index') !~ '^[0-3]$'
   or jsonb_typeof(v_qj->'outcome_title') is distinct from 'string'
   or jsonb_typeof(v_kj->'explanation') is distinct from 'string' or char_length(v_kj->>'explanation') not between 1 and 800
   or jsonb_typeof(v_kj->'citation_ids') is distinct from 'array' or jsonb_array_length(v_kj->'citation_ids') not between 1 and 3 then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  v_oi:=(v_qj->>'outcome_index')::integer;
  if not exists(select 1 from jsonb_array_elements(p_quiz->'outcomes') as o(value) where (o.value->>'index')::integer=v_oi and o.value->>'title'=v_qj->>'outcome_title') then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  -- Kind-dependent key shape.
  if v_kind='short_answer' then
   if coalesce(jsonb_typeof(v_kj->'correct_option_ids'),'null')<>'null' or jsonb_typeof(v_kj->'criteria') is distinct from 'array'
    or jsonb_array_length(v_kj->'criteria') not between 2 and 4 or jsonb_typeof(v_kj->'model_answer') is distinct from 'string'
    or char_length(v_kj->>'model_answer') not between 1 and 800 then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
   if exists(select 1 from jsonb_array_elements(v_kj->'criteria') as c(value) where jsonb_typeof(c.value) is distinct from 'string' or char_length(c.value #>> '{}') not between 1 and 300) then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
   v_correct:=null;
  else
   if coalesce(jsonb_typeof(v_kj->'criteria'),'null')<>'null' or coalesce(jsonb_typeof(v_kj->'model_answer'),'null')<>'null'
    or jsonb_typeof(v_kj->'correct_option_ids') is distinct from 'array'
    or jsonb_array_length(v_kj->'correct_option_ids') not between 1 and 3 then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
   if exists(select 1 from jsonb_array_elements(v_kj->'correct_option_ids') as c(value) where jsonb_typeof(c.value) is distinct from 'string') then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
   v_correct:=array(select y from jsonb_array_elements_text(v_kj->'correct_option_ids') as c(y));
   if (select count(distinct y) from unnest(v_correct) as u(y))<>cardinality(v_correct)
    or exists(select 1 from unnest(v_correct) as u(y) where not exists(select 1 from jsonb_array_elements(v_opts) as o(value) where o.value->>'id'=u.y))
    or (v_kind in ('single_choice','true_false') and cardinality(v_correct)<>1)
    or (v_kind='multi_select' and cardinality(v_correct) not between 2 and 3) then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
  end if;
  -- Citations: ids in this plan's source references and in the cited set of the question's own lesson.
  if (select count(distinct y) from jsonb_array_elements_text(v_kj->'citation_ids') as c(y))<>jsonb_array_length(v_kj->'citation_ids')
   or exists(select 1 from jsonb_array_elements(v_kj->'citation_ids') as c(value) where jsonb_typeof(c.value) is distinct from 'string') then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  v_lesson:=v_lessons->v_oi;
  v_cited:=coalesce(v_lesson->'explanation'->'citation_ids','[]'::jsonb)||coalesce(v_lesson->'check'->'worked_answer'->'citation_ids','[]'::jsonb)
   ||case when v_lesson->'example'->>'provenance'='source_backed' then coalesce(v_lesson->'example'->'citation_ids','[]'::jsonb) else '[]'::jsonb end;
  for v_cid in select y from jsonb_array_elements_text(v_kj->'citation_ids') as c(y) loop
   if char_length(v_cid) not between 1 and 16 or not (v_cited ? v_cid)
    or not exists(select 1 from jsonb_array_elements(v_plan.source_references) as r(value) where r.value->>'id'=v_cid) then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
  end loop;
  insert into public.quiz_questions(quiz_id,user_id,position,kind,prompt,options,outcome_index,outcome_title)
  values(v_q.id,v_q.user_id,v_i,v_kind,v_qj->>'prompt',v_opts,v_oi,v_qj->>'outcome_title') returning id into v_qid;
  insert into public.quiz_question_keys(question_id,quiz_id,user_id,correct_option_ids,explanation,citation_ids,criteria,model_answer)
  values(v_qid,v_q.id,v_q.user_id,v_correct,v_kj->>'explanation',array(select y from jsonb_array_elements_text(v_kj->'citation_ids') as c(y)),
   case when v_kind='short_answer' then v_kj->'criteria' end,case when v_kind='short_answer' then v_kj->>'model_answer' end);
 end loop;
 -- Shape of the whole quiz: at least 3 deterministic questions, at most 2 short answers, 2 deterministic per covered outcome.
 if (select count(*) from jsonb_array_elements(p_quiz->'questions') as e(value) where e.value->>'kind'<>'short_answer')<3
  or (select count(*) from jsonb_array_elements(p_quiz->'questions') as e(value) where e.value->>'kind'='short_answer')>2
  or exists(select 1 from jsonb_array_elements(p_quiz->'outcomes') as o(value) where
   (select count(*) from jsonb_array_elements(p_quiz->'questions') as e(value) where (e.value->>'outcome_index')::integer=(o.value->>'index')::integer and e.value->>'kind'<>'short_answer')<2) then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 update public.quizzes set is_current=false where plan_id=v_q.plan_id and user_id=v_q.user_id and is_current and id<>v_q.id;
 update public.quizzes set status='ready',is_current=true,generated_at=now(),model=p_model,fallback_used=p_fallback_used,question_count=v_n,
  outcomes=p_quiz->'outcomes',tokens_in=p_tokens_in,tokens_out=p_tokens_out,lease_token=null,lease_until=null,error_code=null where id=v_q.id;
 return true;
end;$$;

-- 9. Mark a generation failed (service role); optionally release the current lease's charge once.
create function public.fail_quiz_generation(p_quiz_id uuid,p_lease_token uuid,p_error_code text,p_refund boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_q public.quizzes;
begin
 select * into v_q from public.quizzes where id=p_quiz_id for update;
 if not found then return false;end if;
 if v_q.status='failed' then return true;end if;
 if v_q.status<>'generating' or v_q.lease_token is distinct from p_lease_token then raise exception using errcode='40001',message='quiz_lease_lost';end if;
 if p_error_code='limit' then
  delete from public.quizzes where id=v_q.id;
  return true;
 end if;
 if p_refund is true and v_q.charge_state='charged' and v_q.charged_lease=p_lease_token then
  perform public.quiz_release_usage(v_q.user_id,v_q.charged_on,'generation',1);
  update public.quizzes set charge_state='refunded' where id=v_q.id;
 end if;
 update public.quizzes set status='failed',lease_token=null,lease_until=null,error_code=left(coalesce(p_error_code,'error'),40) where id=v_q.id;
 return true;
end;$$;

-- 10. The only function that returns key material to the backend: a stored attempt under a live lease.
create function public.get_quiz_grading_context(p_attempt_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_att public.quiz_attempts;v_items jsonb;
begin
 select * into v_att from public.quiz_attempts where id=p_attempt_id;
 if not found or v_att.status<>'grading' or v_att.lease_token is distinct from p_lease_token or v_att.lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 select coalesce(jsonb_agg(jsonb_build_object('question_id',x.question_id,'position',q.position,'kind',x.kind,'outcome_index',x.outcome_index,
   'answer',x.answer,'correct_option_ids',to_jsonb(k.correct_option_ids),'explanation',k.explanation,'citation_ids',to_jsonb(k.citation_ids),
   'criteria',k.criteria,'model_answer',k.model_answer,'redacted',q.redacted or x.redacted) order by q.position),'[]'::jsonb) into v_items
 from public.quiz_attempt_answers x join public.quiz_questions q on q.id=x.question_id and q.quiz_id=x.quiz_id and q.user_id=x.user_id
 left join public.quiz_question_keys k on k.question_id=x.question_id
 where x.attempt_id=v_att.id;
 return jsonb_build_object('attempt_id',v_att.id,'user_id',v_att.user_id,'quiz_id',v_att.quiz_id,'plan_id',v_att.plan_id,
  'deterministic_total',v_att.deterministic_total,'short_answer_total',v_att.short_answer_total,'questions',v_items);
end;$$;

-- 11. Store deterministic results and reveal snapshots (service role). p_results = {correct_count, results:[{question_id,result,signal,reveal}]}.
create function public.finish_quiz_attempt(p_attempt_id uuid,p_lease_token uuid,p_results jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_att public.quiz_attempts;v_a public.quiz_attempt_answers;v_e jsonb;v_rev jsonb;v_n integer;v_expected integer;v_correct integer:=0;
 v_result text;v_signal text;v_state text;v_source text;
begin
 select * into v_att from public.quiz_attempts where id=p_attempt_id for update;
 if not found or v_att.status<>'grading' or v_att.lease_token is distinct from p_lease_token or v_att.lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 select count(*) into v_n from public.quiz_attempt_answers where attempt_id=v_att.id;
 if jsonb_typeof(p_results) is distinct from 'object' then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if (p_results-'correct_count'-'results')<>'{}'::jsonb or jsonb_typeof(p_results->'correct_count') is distinct from 'number' or (p_results->>'correct_count') !~ '^[0-9]{1,2}$'
  or jsonb_typeof(p_results->'results') is distinct from 'array' or jsonb_array_length(p_results->'results')<>v_n then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 v_expected:=(p_results->>'correct_count')::integer;
 if exists(select 1 from jsonb_array_elements(p_results->'results') as e(value) where jsonb_typeof(e.value) is distinct from 'object') then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if exists(select 1 from jsonb_array_elements(p_results->'results') as e(value) where (e.value-'question_id'-'result'-'signal'-'reveal')<>'{}'::jsonb
   or jsonb_typeof(e.value->'question_id') is distinct from 'string' or jsonb_typeof(e.value->'reveal') is distinct from 'object')
  or (select count(distinct lower(e.value->>'question_id')) from jsonb_array_elements(p_results->'results') as e(value))<>v_n then
  raise exception using errcode='22023',message='quiz_invalid_output';end if;
 for v_a in select * from public.quiz_attempt_answers where attempt_id=v_att.id order by question_id for update loop
  select e.value into v_e from jsonb_array_elements(p_results->'results') as e(value) where lower(e.value->>'question_id')=v_a.question_id::text;
  if v_e is null then raise exception using errcode='22023',message='quiz_invalid_output';end if;
  v_result:=v_e->>'result';v_signal:=v_e->>'signal';v_rev:=v_e->'reveal';
  if octet_length(v_rev::text)>16384 or (v_rev-'correct_option_ids'-'explanation'-'citation_ids'-'criteria'-'model_answer')<>'{}'::jsonb
   or jsonb_typeof(v_rev->'explanation') is distinct from 'string' or jsonb_typeof(v_rev->'citation_ids') is distinct from 'array' then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if v_a.kind='short_answer' then
   if v_a.answer='{}'::jsonb then
    if v_result is distinct from 'unanswered' or v_signal is distinct from 'negative' then raise exception using errcode='22023',message='quiz_invalid_output';end if;
    v_state:='not_applicable';
   else
    if v_result is not null or v_signal is distinct from 'neutral' then raise exception using errcode='22023',message='quiz_invalid_output';end if;
    v_state:='pending';
   end if;
   v_source:=null;
  else
   if v_result is null or v_result not in ('correct','partly_correct','incorrect','unanswered') or (v_result='partly_correct' and v_a.kind<>'multi_select')
    or v_signal is distinct from (case v_result when 'correct' then 'positive' else 'negative' end)
    or (v_result='unanswered')<>(v_a.answer='{}'::jsonb) then
    raise exception using errcode='22023',message='quiz_invalid_output';end if;
   if v_result='correct' then v_correct:=v_correct+1;end if;
   v_state:='not_applicable';
   v_source:=case when v_result='unanswered' then null else 'deterministic' end;
  end if;
  update public.quiz_attempt_answers set result=v_result,signal=v_signal,grading_source=v_source,grading_state=v_state,reveal=v_rev,graded_at=now()
  where attempt_id=v_a.attempt_id and question_id=v_a.question_id;
 end loop;
 if v_correct<>v_expected or v_expected>v_att.deterministic_total then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 update public.quiz_attempts set status='graded',correct_count=v_correct,graded_at=now(),lease_token=null,lease_until=null where id=v_att.id;
 return true;
end;$$;

-- 12. Everything the short-answer grader may see, under the answer's live lease (service role).
create function public.get_quiz_short_answer_context(p_attempt_id uuid,p_question_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ans public.quiz_attempt_answers;v_att public.quiz_attempts;v_key public.quiz_question_keys;v_q public.quiz_questions;v_plan public.learning_plans;v_passages jsonb;
begin
 select * into v_ans from public.quiz_attempt_answers where attempt_id=p_attempt_id and question_id=p_question_id;
 if not found or v_ans.grading_lease_token is distinct from p_lease_token or v_ans.grading_lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 select * into v_key from public.quiz_question_keys where question_id=v_ans.question_id;
 if v_ans.kind<>'short_answer' or v_ans.redacted or not found then raise exception using errcode='22023',message='quiz_answer_invalid';end if;
 select * into v_att from public.quiz_attempts where id=v_ans.attempt_id;
 select * into v_q from public.quiz_questions where id=v_ans.question_id;
 select * into v_plan from public.learning_plans where id=v_att.plan_id and user_id=v_att.user_id;
 select coalesce(jsonb_agg(r.value order by r.value->>'id'),'[]'::jsonb) into v_passages
 from jsonb_array_elements(v_plan.source_references) as r(value) where r.value->>'id'=any(v_key.citation_ids);
 return jsonb_build_object('user_id',v_att.user_id,'attempt_id',v_att.id,'question_id',v_ans.question_id,'quiz_id',v_att.quiz_id,'plan_id',v_att.plan_id,
  'prompt',v_q.prompt,'criteria',v_key.criteria,'model_answer',v_key.model_answer,'citation_ids',to_jsonb(v_key.citation_ids),
  'answer_text',coalesce(v_ans.answer->>'text',''),'passages',v_passages,'grading_attempts',v_ans.grading_attempts,'grading_state',v_ans.grading_state);
end;$$;

-- 13. Charge one grading under the answer's live lease (service role). The provider-bound try is counted only here.
create function public.charge_quiz_grading(p_attempt_id uuid,p_question_id uuid,p_lease_token uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ans public.quiz_attempt_answers;v_res jsonb;v_used integer;
begin
 select * into v_ans from public.quiz_attempt_answers where attempt_id=p_attempt_id and question_id=p_question_id for update;
 if not found or v_ans.grading_lease_token is distinct from p_lease_token or v_ans.grading_lease_until<=now() then
  raise exception using errcode='40001',message='quiz_lease_lost';end if;
 if v_ans.grading_charge_state='charged' and v_ans.grading_charged_lease=p_lease_token then
  select c.count into v_used from public.quiz_usage_counters c where c.user_id=v_ans.user_id and c.usage_date=v_ans.grading_charged_on and c.kind='grading';
  return jsonb_build_object('allowed',true,'used',coalesce(v_used,0),'limit',p_limit,'usage_date',v_ans.grading_charged_on,
   'resets_at',to_char((v_ans.grading_charged_on+1)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
 end if;
 if v_ans.grading_attempts>=3 then raise exception using errcode='54000',message='quiz_grading_exhausted';end if;
 v_res:=public.quiz_consume_usage(v_ans.user_id,'grading',p_limit,1);
 if (v_res->>'allowed')::boolean then
  update public.quiz_attempt_answers set grading_charge_state='charged',grading_charged_on=(v_res->>'usage_date')::date,grading_charged_lease=p_lease_token,
   grading_attempts=grading_attempts+1 where attempt_id=v_ans.attempt_id and question_id=v_ans.question_id;
 end if;
 return v_res;
end;$$;

-- 14. Store model feedback or an unavailable state (service role). result/signal are re-derived here.
create function public.finish_quiz_short_answer(p_attempt_id uuid,p_question_id uuid,p_lease_token uuid,p_feedback jsonb,p_model text,p_unavailable_reason text,p_refund boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_ans public.quiz_attempt_answers;v_n integer;v_result text;v_signal text;v_ids jsonb;
begin
 select * into v_ans from public.quiz_attempt_answers where attempt_id=p_attempt_id and question_id=p_question_id for update;
 if not found or v_ans.grading_lease_token is distinct from p_lease_token then raise exception using errcode='40001',message='quiz_lease_lost';end if;
 if v_ans.kind<>'short_answer' or (p_feedback is null)=(p_unavailable_reason is null) then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if p_feedback is not null then
  v_n:=coalesce(jsonb_array_length(v_ans.reveal->'criteria'),0);
  v_ids:=coalesce(v_ans.reveal->'citation_ids','[]'::jsonb);
  if v_n=0 or p_model is null or p_model !~ '^[A-Za-z0-9._:-]{1,64}$' or jsonb_typeof(p_feedback) is distinct from 'object' then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if (p_feedback-'summary'-'next_hint'-'criteria'-'result'-'signal')<>'{}'::jsonb
   or jsonb_typeof(p_feedback->'summary') is distinct from 'string' or char_length(p_feedback->>'summary') not between 1 and 800
   or jsonb_typeof(p_feedback->'next_hint') is distinct from 'string' or char_length(p_feedback->>'next_hint')>400
   or jsonb_typeof(p_feedback->'criteria') is distinct from 'array' or jsonb_array_length(p_feedback->'criteria')<>v_n then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value) where jsonb_typeof(c.value) is distinct from 'object') then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value) where (c.value-'criterion_index'-'assessment'-'observation'-'citation_ids')<>'{}'::jsonb
    or jsonb_typeof(c.value->'criterion_index') is distinct from 'number' or (c.value->>'criterion_index') !~ '^[0-3]$'
    or c.value->>'assessment' is null or c.value->>'assessment' not in ('addressed','try_again','uncertain')
    or jsonb_typeof(c.value->'observation') is distinct from 'string' or char_length(c.value->>'observation') not between 1 and 500
    or jsonb_typeof(c.value->'citation_ids') is distinct from 'array')
   or (select count(distinct (c.value->>'criterion_index')::integer) from jsonb_array_elements(p_feedback->'criteria') as c(value))<>v_n
   or exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value) where (c.value->>'criterion_index')::integer>=v_n) then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value),jsonb_array_elements(c.value->'citation_ids') as i(value)
    where jsonb_typeof(i.value) is distinct from 'string' or not (v_ids ? (i.value #>> '{}'))) then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  if not exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value) where c.value->>'assessment'<>'addressed') then v_result:='addressed';v_signal:='positive';
  elsif exists(select 1 from jsonb_array_elements(p_feedback->'criteria') as c(value) where c.value->>'assessment'='try_again') then v_result:='needs_review';v_signal:='negative';
  else v_result:='uncertain';v_signal:='neutral';
  end if;
  if p_feedback->>'result' is distinct from v_result or p_feedback->>'signal' is distinct from v_signal then
   raise exception using errcode='22023',message='quiz_invalid_output';end if;
  update public.quiz_attempt_answers set grading_state='graded',grading_source='model',result=v_result,signal=v_signal,feedback=p_feedback-'result'-'signal',
   model=p_model,unavailable_reason=null,grading_lease_token=null,grading_lease_until=null,graded_at=now()
  where attempt_id=v_ans.attempt_id and question_id=v_ans.question_id;
  return true;
 end if;
 if p_unavailable_reason not in ('limit','provider','invalid_output','setup_required','timeout') then raise exception using errcode='22023',message='quiz_invalid_output';end if;
 if p_refund is true and v_ans.grading_charge_state='charged' and v_ans.grading_charged_lease=p_lease_token then
  perform public.quiz_release_usage(v_ans.user_id,v_ans.grading_charged_on,'grading',1);
  update public.quiz_attempt_answers set grading_charge_state='refunded',grading_attempts=greatest(grading_attempts-1,0)
  where attempt_id=v_ans.attempt_id and question_id=v_ans.question_id;
 end if;
 update public.quiz_attempt_answers set grading_state='unavailable',unavailable_reason=p_unavailable_reason,result='unavailable',signal='neutral',
  grading_lease_token=null,grading_lease_until=null where attempt_id=v_ans.attempt_id and question_id=v_ans.question_id;
 return true;
end;$$;

-- Source removal: keys deleted, question and reveal text removed, scores and per-question results kept.
create function public.redact_removed_quiz_content() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];
begin
 select coalesce(array_agg(z.id),'{}') into v_ids from public.quizzes z
  join public.learning_plans n on n.id=z.plan_id and n.user_id=z.user_id
  join public.learning_paths p on p.id=n.path_id and p.user_id=n.user_id
  where z.user_id=old.user_id and (p.original_source_id=old.id or exists(select 1 from jsonb_array_elements(n.source_members) m where m->>'source_id'=old.id::text));
 if cardinality(v_ids)=0 then return old;end if;
 delete from public.quiz_question_keys where quiz_id=any(v_ids);
 update public.quiz_questions set prompt=null,options=null,redacted=true where quiz_id=any(v_ids);
 update public.quiz_attempt_answers set reveal=null,feedback=null,redacted=true where quiz_id=any(v_ids);
 update public.quizzes set redacted_at=coalesce(redacted_at,now()) where id=any(v_ids);
 return old;
end;$$;
create trigger quiz_source_removed before delete on public.sources for each row execute function public.redact_removed_quiz_content();

-- Privileges: nothing is callable unless granted below. Functions 15, 16, the helpers and the trigger function have no grantee.
revoke execute on function
 public.quiz_options_valid(text,jsonb),
 public.quiz_consume_usage(uuid,text,integer,integer),
 public.quiz_release_usage(uuid,date,text,integer),
 public.quiz_lease_attempt(uuid),
 public.get_quiz_state(uuid,uuid,boolean),
 public.request_quiz_generation(uuid,uuid,uuid,boolean),
 public.submit_quiz_attempt(uuid,uuid,uuid,uuid,jsonb,text),
 public.claim_quiz_attempt_grading(uuid,uuid,uuid),
 public.get_quiz_attempt(uuid,uuid,uuid),
 public.claim_quiz_short_answer(uuid,uuid,uuid,uuid),
 public.charge_quiz_generation(uuid,uuid,integer),
 public.finish_quiz_generation(uuid,uuid,jsonb,text,boolean,integer,integer),
 public.fail_quiz_generation(uuid,uuid,text,boolean),
 public.get_quiz_grading_context(uuid,uuid),
 public.finish_quiz_attempt(uuid,uuid,jsonb),
 public.get_quiz_short_answer_context(uuid,uuid,uuid),
 public.charge_quiz_grading(uuid,uuid,uuid,integer),
 public.finish_quiz_short_answer(uuid,uuid,uuid,jsonb,text,text,boolean),
 public.redact_removed_quiz_content()
from public,anon,authenticated,service_role;
grant execute on function
 public.get_quiz_state(uuid,uuid,boolean),
 public.request_quiz_generation(uuid,uuid,uuid,boolean),
 public.submit_quiz_attempt(uuid,uuid,uuid,uuid,jsonb,text),
 public.claim_quiz_attempt_grading(uuid,uuid,uuid),
 public.get_quiz_attempt(uuid,uuid,uuid),
 public.claim_quiz_short_answer(uuid,uuid,uuid,uuid)
to authenticated;
grant execute on function
 public.charge_quiz_generation(uuid,uuid,integer),
 public.finish_quiz_generation(uuid,uuid,jsonb,text,boolean,integer,integer),
 public.fail_quiz_generation(uuid,uuid,text,boolean),
 public.get_quiz_grading_context(uuid,uuid),
 public.finish_quiz_attempt(uuid,uuid,jsonb),
 public.get_quiz_short_answer_context(uuid,uuid,uuid),
 public.charge_quiz_grading(uuid,uuid,uuid,integer),
 public.finish_quiz_short_answer(uuid,uuid,uuid,jsonb,text,text,boolean)
to service_role;
commit;
