-- Initial full-capture teaching only. Existing notes/plans remain immutable.
begin;
alter table public.learning_previews add column evidence_mode text not null default 'note' check(evidence_mode in ('note','capture'));
alter table public.learning_plans add column teaching jsonb check(teaching is null or jsonb_typeof(teaching)='object' and octet_length(teaching::text)<=65536);

alter function public.request_learning_preview(uuid,integer,uuid,text,text,uuid) rename to request_learning_preview_note;
revoke execute on function public.request_learning_preview_note(uuid,integer,uuid,text,text,uuid) from public,anon,authenticated,service_role;
create function public.request_learning_preview_mode(p_source_id uuid,p_source_version integer,p_request_id uuid,p_goal text,p_difficulty text,p_path_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.learning_previews;result jsonb;
begin
 if auth.uid() is null then raise exception using errcode='P0002',message='Source not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform 1 from public.sources where id=p_source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source not found';end if;
 if p_mode is null or p_mode not in ('note','capture') or p_mode='capture' and p_path_id is not null then
  raise exception using errcode='22023',message='Full capture is for new paths only';end if;
 select * into r from public.learning_previews where id=p_request_id;
 if found then
  if r.user_id<>auth.uid() or r.source_id<>p_source_id then raise exception using errcode='P0002',message='Request not found';end if;
  if r.evidence_mode<>p_mode then raise exception using errcode='40001',message='Request evidence mode changed';end if;
 end if;
 result:=public.request_learning_preview_note(p_source_id,p_source_version,p_request_id,p_goal,p_difficulty,p_path_id);
 update public.learning_previews set evidence_mode=p_mode,
  lease_until=case when p_mode='capture' and result->>'lease_token' is not null then now()+interval '180 seconds' else lease_until end where id=p_request_id;
 return result||jsonb_build_object('evidence_mode',p_mode);
end;$$;
create function public.request_learning_preview(p_source_id uuid,p_source_version integer,p_request_id uuid,p_goal text,p_difficulty text,p_path_id uuid default null)
returns jsonb language sql security definer set search_path='' as $$
 select public.request_learning_preview_mode(p_source_id,p_source_version,p_request_id,p_goal,p_difficulty,p_path_id,'note');$$;
create function public.request_learning_capture_preview(p_source_id uuid,p_source_version integer,p_request_id uuid,p_goal text,p_difficulty text,p_path_id uuid default null)
returns jsonb language sql security definer set search_path='' as $$
 select public.request_learning_preview_mode(p_source_id,p_source_version,p_request_id,p_goal,p_difficulty,p_path_id,'capture');$$;

alter function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text) rename to finish_learning_preview_note;
revoke execute on function public.finish_learning_preview_note(uuid,uuid,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.finish_learning_preview(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_goal text,p_references jsonb,p_model text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.learning_previews where id=p_request_id and lease_token=p_lease_token and evidence_mode='note') then
  raise exception using errcode='40001',message='Request evidence mode changed';end if;
 return public.finish_learning_preview_note(p_request_id,p_lease_token,p_draft,p_goal,p_references,p_model);
end;$$;

-- Unicode offsets and physical page/cue metadata refer to the original capture.
create function public.capture_learning_reference_valid(s public.sources,r jsonb) returns boolean
language plpgsql set search_path='' as $$
declare a integer;b integer;segments jsonb;first_cue jsonb;last_end integer;
begin
 if jsonb_typeof(r)<>'object' or not(r ?& array['id','start','end','excerpt','page','start_ms','end_ms'])
  or (select count(*) from jsonb_object_keys(r))<>7
  or jsonb_typeof(r->'id')<>'string' or char_length(r->>'id') not between 1 and 16
  or jsonb_typeof(r->'excerpt')<>'string' or char_length(r->>'excerpt') not between 1 and 1000
  or jsonb_typeof(r->'start') is distinct from 'number' or jsonb_typeof(r->'end') is distinct from 'number'
  or (r->>'start') !~ '^[0-9]+$' or (r->>'end') !~ '^[0-9]+$' then return false;end if;
 if r->'page'<>'null'::jsonb and (jsonb_typeof(r->'page')<>'number' or (r->>'page') !~ '^[0-9]+$' or (r->>'page')::integer not between 1 and 100) then return false;end if;
 if r->'start_ms'<>'null'::jsonb or r->'end_ms'<>'null'::jsonb then
  if jsonb_typeof(r->'start_ms') is distinct from 'number' or jsonb_typeof(r->'end_ms') is distinct from 'number'
   or (r->>'start_ms') !~ '^[0-9]+$' or (r->>'end_ms') !~ '^[0-9]+$'
   or (r->>'start_ms')::integer<0 or (r->>'end_ms')::integer<=(r->>'start_ms')::integer or (r->>'end_ms')::integer>604800000 then return false;end if;
 end if;
 a:=(r->>'start')::integer;b:=(r->>'end')::integer;
 if a<0 or b<=a or b>char_length(s.captured_text) or substring(s.captured_text from a+1 for b-a)<>r->>'excerpt' then return false;end if;
 if s.document is not null then
  return r->>'start_ms' is null and r->>'end_ms' is null and exists(select 1 from jsonb_array_elements(s.document->'pages') p
   where p->'page'=r->'page' and (p->>'start')::integer<=a and (p->>'end')::integer>=b);
 elsif s.transcript is not null then
  if r->>'page' is not null then return false;end if;
  select jsonb_agg(c order by (c->>'start')::integer),max((c->>'end_ms')::integer) into segments,last_end
   from jsonb_array_elements(s.transcript->'segments') c where (c->>'start')::integer<b and (c->>'end')::integer>a;
  first_cue:=segments->0;
  return coalesce(jsonb_array_length(segments),0)>0 and a>=(first_cue->>'start')::integer and a<(first_cue->>'end')::integer
   and b>(segments->(jsonb_array_length(segments)-1)->>'start')::integer and b<=(segments->(jsonb_array_length(segments)-1)->>'end')::integer
   and not exists(select 1 from jsonb_array_elements(segments) with ordinality c(value,ordinality)
    where c.ordinality>1 and substring(s.captured_text from (segments->(c.ordinality::integer-2)->>'end')::integer+1 for (c.value->>'start')::integer-(segments->(c.ordinality::integer-2)->>'end')::integer)<>E'\n')
   and r->>'start_ms' is not distinct from first_cue->>'start_ms'
   and (r->>'end_ms')::integer is not distinct from last_end;
 end if;
 return r->>'page' is null and r->>'start_ms' is null and r->>'end_ms' is null;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end;$$;

create function public.capture_learning_claim_valid(c jsonb,refs jsonb,required boolean default true) returns boolean
language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(c->'citation_ids') is distinct from 'array' or jsonb_array_length(c->'citation_ids')>10
  or required and jsonb_array_length(c->'citation_ids')=0 then return false;end if;
 return not exists(select 1 from jsonb_array_elements(c->'citation_ids') id
  where not exists(select 1 from jsonb_array_elements(refs) r where r->'id'=id));
end;$$;

create function public.finish_learning_capture_preview(p_request_id uuid,p_lease_token uuid,p_draft jsonb,p_goal text,p_references jsonb,p_model text,p_manifest jsonb,p_sources jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.learning_previews;s public.sources;n public.source_studies;ix public.retrieval_indexes;snap jsonb;ref jsonb;item jsonb;lesson jsonb;entry jsonb;pid uuid;idx integer:=0;metadata jsonb;
begin
 select * into r from public.learning_previews where id=p_request_id and lease_token=p_lease_token and evidence_mode='capture';
 if not found then raise exception using errcode='P0002',message='Capture request not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.user_id::text,0));
 select * into s from public.sources where id=r.source_id and user_id=r.user_id for update;
 if not found then raise exception using errcode='P0002',message='Source removed';end if;
 select * into ix from public.retrieval_indexes where source_id=s.id and user_id=r.user_id for update;
 select * into r from public.learning_previews where id=p_request_id for update;
 if r.status<>'processing' or r.lease_token is distinct from p_lease_token or r.lease_until<=now() or s.source_version<>r.source_version then
  raise exception using errcode='40001',message='Expired or stale generation';end if;
 if p_draft is null then
  update public.learning_previews set status='failed',lease_token=null,lease_until=null where id=r.id;return true;
 end if;
 select * into n from public.source_studies where source_id=s.id and user_id=r.user_id and status='succeeded' and source_version=s.source_version for share;
 snap:=p_sources->0;
 if n.source_id is null or jsonb_typeof(p_sources) is distinct from 'array' or jsonb_array_length(p_sources)<>1
  or snap->>'source_id' is distinct from s.id::text or snap->>'user_id' is distinct from r.user_id::text
  or (snap->>'source_version')::integer is distinct from s.source_version or snap->>'scope' is distinct from 'note'
  or (snap->>'study_updated_at')::timestamptz is distinct from n.updated_at or snap->>'map_updated_at' is not null
  or ix.status is distinct from 'ready' or ix.action is distinct from 'index' or ix.source_version is distinct from s.source_version
  or ix.capture_sha256 is distinct from encode(sha256(convert_to(s.captured_text,'UTF8')),'hex')
  or snap->>'capture_sha256' is distinct from ix.capture_sha256 or snap->>'generation' is distinct from ix.generation::text
  or (snap->>'chunks_total')::integer is distinct from ix.chunks_total or ix.chunks_total<=0 or ix.chunks_completed<>ix.chunks_total
  or ix.chunk_policy is distinct from 'structure_recursive_v1' or ix.embedding_model is distinct from 'text-embedding-3-small'
  or ix.embedding_dimensions is distinct from 1536 or ix.collection_name is distinct from 'web_sources_recursive_v1_openai_small_1536' then
  raise exception using errcode='40001',message='Captured teaching evidence changed';end if;
 if r.path_id is not null or jsonb_typeof(p_draft->'paths') is distinct from 'array' or jsonb_array_length(p_draft->'paths') not between 1 and 3
  or p_goal is null or char_length(btrim(p_goal)) not between 1 and 500 or p_model is null or p_model not in ('gpt-6-luna','gpt-6.1-sol')
  or jsonb_typeof(p_references) is distinct from 'array' or jsonb_array_length(p_references) not between 1 and 24 then
  raise exception using errcode='22023',message='Invalid captured teaching draft';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_references))<>jsonb_array_length(p_references)
  or (select sum(char_length(value->>'excerpt')) from jsonb_array_elements(p_references))>16000 then
  raise exception using errcode='22023',message='Invalid captured references';end if;
 for ref in select value from jsonb_array_elements(p_references) loop
  if public.capture_learning_reference_valid(s,ref) is not true then raise exception using errcode='22023',message='Invalid original capture reference';end if;
 end loop;
 if p_manifest->>'policy_version' is distinct from 'teaching_manifest_v1' or jsonb_typeof(p_manifest->'coverage') is distinct from 'string'
  or char_length(p_manifest->>'coverage') not between 1 and 1000 or jsonb_typeof(p_manifest->'gaps') is distinct from 'array'
  or jsonb_array_length(p_manifest->'gaps')>5 or jsonb_typeof(p_manifest->'entries') is distinct from 'array'
  or jsonb_array_length(p_manifest->'entries') not between 1 and 24 then raise exception using errcode='22023',message='Invalid teaching manifest';end if;
 if exists(select 1 from jsonb_array_elements(p_manifest->'gaps') gap where jsonb_typeof(gap)<>'string' or char_length(gap#>>'{}') not between 1 and 500) then
  raise exception using errcode='22023',message='Invalid manifest gaps';end if;
 for entry in select value from jsonb_array_elements(p_manifest->'entries') loop
  if entry->>'kind' is null or entry->>'kind' not in ('concept','prerequisite','example','qualification')
   or jsonb_typeof(entry->'text') is distinct from 'string' or char_length(entry->>'text') not between 1 and 500 or public.capture_learning_claim_valid(entry,p_references) is not true then
   raise exception using errcode='22023',message='Invalid manifest evidence';end if;
 end loop;
 if (select count(*) from public.learning_plans lp join public.learning_paths p on p.id=lp.path_id where p.source_id=s.id and p.user_id=r.user_id)+jsonb_array_length(p_draft->'paths')>40 then
  raise exception using errcode='54000',message='Learning plan limit reached';end if;
 metadata:=jsonb_build_object('selector_policy','teaching_evidence_v1','source_id',s.id,'source_version',s.source_version,
  'capture_sha256',ix.capture_sha256,'index_generation',ix.generation,'manifest',p_manifest);
 for item in select value from jsonb_array_elements(p_draft->'paths') loop
  if jsonb_typeof(item->'lessons') is distinct from 'array' or jsonb_array_length(item->'lessons') not between 1 and 4 then
   raise exception using errcode='22023',message='Invalid captured lessons';end if;
  for lesson in select value from jsonb_array_elements(item->'lessons') loop
   if jsonb_typeof(lesson->'check'->'criteria') is distinct from 'array' or jsonb_array_length(lesson->'check'->'criteria') not between 1 and 5
    or public.capture_learning_claim_valid(lesson->'explanation',p_references) is not true
    or public.capture_learning_claim_valid(lesson->'check'->'worked_answer',p_references) is not true then
    raise exception using errcode='22023',message='Invalid captured teaching citation';end if;
   if lesson->'example'<>'null'::jsonb then
    if lesson->'example'->>'provenance' is null or lesson->'example'->>'provenance' not in ('source_backed','generated_example')
     or public.capture_learning_claim_valid(lesson->'example',p_references,lesson->'example'->>'provenance'='source_backed') is not true
     or lesson->'example'->>'provenance'='generated_example' and jsonb_array_length(lesson->'example'->'citation_ids')<>0 then
     raise exception using errcode='22023',message='Invalid example provenance';end if;
   end if;
  end loop;
  insert into public.learning_paths(user_id,source_id,original_source_id,source_title) values(r.user_id,s.id,s.id,s.title) returning id into pid;
  insert into public.learning_plans(path_id,request_id,choice_index,user_id,source_version,goal,difficulty,content,source_references,model,teaching)
   values(pid,r.id,idx,r.user_id,s.source_version,p_goal,r.difficulty,item,p_references,p_model,metadata);idx:=idx+1;
 end loop;
 update public.learning_previews set status='ready',lease_token=null,lease_until=null where id=r.id;return true;
end;$$;

alter function public.get_source_learning(uuid) rename to get_source_learning_before_capture;
revoke execute on function public.get_source_learning_before_capture(uuid) from public,anon,authenticated,service_role;
create function public.get_source_learning(p_source_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;plans jsonb;
begin
 result:=public.get_source_learning_before_capture(p_source_id);
 select coalesce(jsonb_agg(item||jsonb_build_object('teaching',p.teaching) order by p.created_at,p.id),'[]'::jsonb) into plans
 from jsonb_array_elements(result->'plans') item join public.learning_plans p on p.id=(item->>'id')::uuid and p.user_id=auth.uid();
 return result||jsonb_build_object('plans',plans);
end;$$;
create function public.redact_capture_learning_manifest() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.learning_plans p set teaching=null from public.learning_paths path
  where path.id=p.path_id and path.source_id=old.id and path.user_id=old.user_id and p.user_id=old.user_id;
 return old;
end;$$;
create trigger redact_capture_learning_manifest before delete on public.sources for each row execute function public.redact_capture_learning_manifest();
revoke execute on function public.request_learning_preview_mode(uuid,integer,uuid,text,text,uuid,text),
 public.capture_learning_reference_valid(public.sources,jsonb),public.capture_learning_claim_valid(jsonb,jsonb,boolean),
 public.redact_capture_learning_manifest(),public.request_learning_preview(uuid,integer,uuid,text,text,uuid),
 public.request_learning_capture_preview(uuid,integer,uuid,text,text,uuid),public.get_source_learning(uuid),
 public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text),public.finish_learning_capture_preview(uuid,uuid,jsonb,text,jsonb,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.request_learning_preview(uuid,integer,uuid,text,text,uuid),public.request_learning_capture_preview(uuid,integer,uuid,text,text,uuid),public.get_source_learning(uuid) to authenticated;
grant execute on function public.finish_learning_preview(uuid,uuid,jsonb,text,jsonb,text),public.finish_learning_capture_preview(uuid,uuid,jsonb,text,jsonb,text,jsonb,jsonb) to service_role;
commit;
