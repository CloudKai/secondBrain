-- Run after ALL migrations in a disposable database. Rolls back all fixtures.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail)
 values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
 'https://example.org/retrieval','https://example.org/retrieval','Index acceptance',repeat('Exact captured evidence. ',12),'pasted','unknown','Acceptance capture');
do $$ begin
 if public.get_retrieval_index_status('33333333-3333-4333-8333-333333333333')->>'status'<>'queued' then raise exception 'Capture must queue indexing';end if;
 begin
  perform public.claim_retrieval_index('33333333-3333-4333-8333-333333333333');
  raise exception 'Learner claimed worker work';
 exception when insufficient_privilege then null;end;
 begin
  perform 1 from public.retrieval_indexes;
  raise exception 'Learner read private manifest';
 exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 begin
  perform public.get_retrieval_index_status('33333333-3333-4333-8333-333333333333');
  raise exception 'Cross-owner status exposed';
 exception when no_data_found then null;end;
end;$$;
reset role;

do $$ declare c jsonb; d jsonb; v_id uuid := '33333333-3333-4333-8333-333333333333';begin
 set local role service_role;
 c:=public.claim_retrieval_index(v_id);
 if c is null or c->>'user_id'<>'11111111-1111-4111-8111-111111111111' or c->>'action'<>'index' then raise exception 'Invalid owned claim';end if;
 if public.claim_retrieval_index(v_id) is not null then raise exception 'Duplicate active claim';end if;
 if not public.checkpoint_retrieval_index(v_id,(c->>'generation')::uuid,(c->>'lease_token')::uuid,1,2) then raise exception 'Checkpoint failed';end if;
 if public.finish_retrieval_index(v_id,(c->>'generation')::uuid,(c->>'lease_token')::uuid,null) then raise exception 'Incomplete manifest marked ready';end if;
 if not public.finish_retrieval_index(v_id,(c->>'generation')::uuid,(c->>'lease_token')::uuid,'provider_unavailable') then raise exception 'Retry not recorded';end if;
 update public.retrieval_indexes set next_attempt_at=now() where source_id=v_id;
 d:=public.claim_retrieval_index(v_id);
 if d->>'generation'<>c->>'generation' or (d->>'chunks_completed')::integer<>1 then raise exception 'Retry lost committed checkpoint';end if;
 -- Replacing a capture supersedes old generation/lease atomically.
 reset role;
 update public.sources set source_version=2,captured_text=repeat('Replacement capture evidence. ',12) where id=v_id;
 set local role service_role;
 if public.checkpoint_retrieval_index(v_id,(d->>'generation')::uuid,(d->>'lease_token')::uuid,2,2) then raise exception 'Old checkpoint survived refresh';end if;
 if public.finish_retrieval_index(v_id,(d->>'generation')::uuid,(d->>'lease_token')::uuid,null) then raise exception 'Old completion survived refresh';end if;
 update public.retrieval_indexes set next_attempt_at=now() where source_id=v_id;
 c:=public.claim_retrieval_index(v_id);
 if (c->>'source_version')::integer<>2 or c->>'generation'=d->>'generation' then raise exception 'Refresh did not produce new manifest';end if;
 update public.retrieval_indexes set lease_until=now()-interval '1 second' where source_id=v_id;
 if public.checkpoint_retrieval_index(v_id,(c->>'generation')::uuid,(c->>'lease_token')::uuid,1,2) then raise exception 'Expired checkpoint accepted';end if;
 perform public.due_retrieval_indexes(25);
 d:=public.claim_retrieval_index(v_id);
 if d is null then raise exception 'Expired lease was not recoverable';end if;
 if not public.checkpoint_retrieval_index(v_id,(d->>'generation')::uuid,(d->>'lease_token')::uuid,2,2) then raise exception 'Recovery checkpoint failed';end if;
 if not public.finish_retrieval_index(v_id,(d->>'generation')::uuid,(d->>'lease_token')::uuid,null) then raise exception 'Complete work not ready';end if;
 reset role;
 delete from public.sources where id=v_id;
 set local role service_role;
 if public.finish_retrieval_index(v_id,(d->>'generation')::uuid,(d->>'lease_token')::uuid,null) then raise exception 'Deleted source republished';end if;
 c:=public.claim_retrieval_index(v_id);
 if c->>'action'<>'delete' or c->>'captured_text' is not null then raise exception 'Missing privacy-preserving tombstone';end if;
 if not public.finish_retrieval_index(v_id,(c->>'generation')::uuid,(c->>'lease_token')::uuid,null) then raise exception 'Cleanup not recorded';end if;
 if public.claim_retrieval_index(v_id) is not null then raise exception 'Completed tombstone reclaimed';end if;
 reset role;
end;$$;
rollback;
