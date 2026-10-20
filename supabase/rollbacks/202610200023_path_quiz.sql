-- Destructive rollback of 202610200023_path_quiz.sql. Refuses to run while any quiz attempt exists:
-- attempts are learner work, so export them first. Quizzes, keys and usage counters are regenerable.
--
-- Non-destructive alternative for a database that already holds attempts (forward compatible, same
-- idea as rollbacks/202610100021): pause generation and feedback but keep reads, attempts and redaction.
--   begin;
--   revoke execute on function public.request_quiz_generation(uuid,uuid,uuid,boolean) from authenticated;
--   revoke execute on function public.submit_quiz_attempt(uuid,uuid,uuid,uuid,jsonb,text) from authenticated;
--   revoke execute on function public.claim_quiz_short_answer(uuid,uuid,uuid,uuid) from authenticated;
--   revoke execute on function public.charge_quiz_generation(uuid,uuid,integer),
--    public.finish_quiz_generation(uuid,uuid,jsonb,text,boolean,integer,integer),
--    public.charge_quiz_grading(uuid,uuid,uuid,integer),
--    public.finish_quiz_short_answer(uuid,uuid,uuid,jsonb,text,text,boolean) from service_role;
--   commit;
begin;
lock table public.quiz_attempt_answers,public.quiz_attempts,public.quiz_question_keys,public.quiz_questions,public.quizzes,public.quiz_usage_counters in access exclusive mode;
do $$
begin
 if exists(select 1 from public.quiz_attempts) then raise exception 'Export quiz attempts before rollback';end if;
end;$$;
drop trigger quiz_source_removed on public.sources;
drop function public.redact_removed_quiz_content();
drop table public.quiz_attempt_answers,public.quiz_attempts,public.quiz_question_keys,public.quiz_questions,public.quizzes,public.quiz_usage_counters;
drop function
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
 public.quiz_lease_attempt(uuid),
 public.quiz_release_usage(uuid,date,text,integer),
 public.quiz_consume_usage(uuid,text,integer,integer);
-- Last: the CHECK on quiz_questions depended on this helper, so it can only go after that table.
drop function public.quiz_options_valid(text,jsonb);
commit;
