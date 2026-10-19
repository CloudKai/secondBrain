-- Execute against a disposable database after all migrations; fixtures roll back.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.sources(id,user_id,original_url,canonical_url,title,captured_text,capture_origin,coverage,coverage_detail)
values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','https://example.org/hybrid','https://example.org/hybrid','Hybrid note',repeat('Original captured learning evidence. ',10),'pasted','unknown','Disposable acceptance'),
('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','https://example.org/hybrid-other','https://example.org/hybrid-other','Other note',repeat('Evidence omitted from the study note. ',10),'pasted','unknown','Disposable acceptance'),
('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','https://example.org/private','https://example.org/private','Private note',repeat('Unowned learning evidence. ',10),'pasted','unknown','Disposable acceptance');
insert into public.source_studies(source_id,user_id,status,note,source_version)
select id,user_id,'succeeded','{"references":[]}'::jsonb,1 from public.sources;
update public.retrieval_indexes set status='ready',chunks_total=1,chunks_completed=1;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare inventory jsonb;rows jsonb;normalized jsonb;begin
 inventory:=public.get_assistant_search_inventory('33333333-3333-4333-8333-333333333333',1,null,true);
 if jsonb_array_length(inventory)<>2 or inventory->0->>'scope'<>'note' or inventory->1->>'scope'<>'library' then raise exception 'Invalid owned library inventory';end if;
 rows:=public.get_hybrid_assistant_context('33333333-3333-4333-8333-333333333333',1,null,true,inventory);
 if jsonb_array_length(rows)<>2 or rows->1->>'captured_text' not like 'Evidence omitted%' then raise exception 'Original capture unavailable';end if;
 select jsonb_agg(jsonb_set(x,'{study_updated_at}',to_jsonb(to_char((x->>'study_updated_at')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))) order by ord) into normalized from jsonb_array_elements(inventory) with ordinality v(x,ord);
 if not public.validate_hybrid_assistant_context('33333333-3333-4333-8333-333333333333',1,null,true,normalized) then raise exception 'Equivalent UTC timestamp rejected';end if;
 if not public.validate_hybrid_assistant_context('33333333-3333-4333-8333-333333333333',1,null,true,inventory) then raise exception 'Fresh inventory rejected';end if;
 if public.validate_hybrid_assistant_context('33333333-3333-4333-8333-333333333333',1,null,false,inventory) then raise exception 'Unselected library accepted';end if;
end;$$;
-- Exact snapshots fence index refresh, study changes and removal.
do $$ declare old jsonb;fresh jsonb;sid uuid:='33333333-3333-4333-8333-333333333333';begin
 old:=public.get_assistant_search_inventory(sid,1,null,true);
 reset role;
 update public.retrieval_indexes set generation=gen_random_uuid() where source_id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 if public.validate_hybrid_assistant_context(sid,1,null,true,old) then raise exception 'Old generation accepted';end if;
 begin
  perform public.get_hybrid_assistant_context(sid,1,null,true,old);
  raise exception 'Changed evidence loaded';
 exception when serialization_failure then null;end;
 old:=public.get_assistant_search_inventory(sid,1,null,true);
 reset role;
 update public.source_studies set updated_at=updated_at+interval '1 second' where source_id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 if public.validate_hybrid_assistant_context(sid,1,null,true,old) then raise exception 'Changed study accepted';end if;
 reset role;
 update public.retrieval_indexes set status='processing' where source_id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 fresh:=public.get_assistant_search_inventory(sid,1,null,true);
 if fresh->1->>'generation' is not null or fresh->1->>'chunks_total'<>'0' then raise exception 'Unready index exposed';end if;
 if public.validate_hybrid_assistant_context(sid,1,null,true,fresh) then raise exception 'Unready additional source accepted';end if;
 reset role;
 update public.retrieval_indexes set status='ready' where source_id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 old:=public.get_assistant_search_inventory(sid,1,null,true);
 reset role;
 update public.sources set source_version=2,captured_text=repeat('Replacement captured evidence. ',10) where id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 if public.validate_hybrid_assistant_context(sid,1,null,true,old) then raise exception 'Refreshed capture accepted';end if;
 reset role;
 delete from public.sources where id='44444444-4444-4444-8444-444444444444';
 set local role authenticated;
 if public.validate_hybrid_assistant_context(sid,1,null,true,old) then raise exception 'Removed source accepted';end if;
end;$$;
reset role;
insert into public.source_topic_maps(source_id,user_id,status,analysis)
values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','succeeded',
 '{"topics":[{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","uncertain":false}],"relations":[],"catalog_partial":false}'::jsonb)
on conflict(source_id) do update set status=excluded.status,analysis=excluded.analysis,lease_token=null,lease_until=null;
set local role authenticated;
do $$ declare snapshot jsonb;sid uuid:='33333333-3333-4333-8333-333333333333';topic uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';begin
 snapshot:=public.get_assistant_search_inventory(sid,1,topic,false);
 if jsonb_array_length(snapshot)<>1 then raise exception 'Topic included unrelated source';end if;
 reset role;
 update public.source_topic_maps set updated_at=updated_at+interval '1 second' where source_id=sid;
 set local role authenticated;
 if public.validate_hybrid_assistant_context(sid,1,topic,false,snapshot) then raise exception 'Topic revision changed';end if;
end;$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 begin
  perform public.get_assistant_search_inventory('33333333-3333-4333-8333-333333333333',1,null,true);
  raise exception 'Cross-owner inventory exposed';
 exception when no_data_found then null;end;
end;$$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.get_assistant_search_inventory('33333333-3333-4333-8333-333333333333',1,null,true);
  raise exception 'Anonymous inventory exposed';
 exception when insufficient_privilege then null;end;
end;$$;
rollback;
