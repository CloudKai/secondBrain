-- Ledger rollback preserves current corrected maps and all original notes.
begin;
drop trigger remember_source_topics on public.source_topic_maps;
drop trigger enforce_topic_rules on public.source_topic_maps;
drop function public.correct_topic_library(jsonb);
drop function public.remember_source_topics();
drop function public.enforce_topic_rules();
drop function public.apply_topic_rules(uuid,jsonb);
drop function public.canonical_topic_id(uuid,uuid);
drop table public.source_topic_overrides;
drop table public.topic_connection_decisions;
drop table public.topic_rules;
create or replace function public.claim_source_topics(p_source_id uuid)
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


commit;
