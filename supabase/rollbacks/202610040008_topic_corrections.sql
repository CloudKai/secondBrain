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


create or replace function public.finish_source_topics(p_source_id uuid,p_lease_token uuid,p_analysis jsonb,p_error_code text)
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


commit;
