-- Current source identity is stable; archived capture/note pairs are immutable.
begin;
alter table public.sources add column source_version integer not null default 1 check(source_version between 1 and 20);
alter table public.source_studies add column source_version integer not null default 1 check(source_version between 1 and 20);

create table public.source_versions (
 source_id uuid not null,user_id uuid not null,version integer not null check(version between 1 and 20),
 source jsonb not null,study jsonb,
 primary key(source_id,version),foreign key(source_id,user_id) references public.sources(id,user_id) on delete cascade
);
create table public.source_revision_candidates (
 source_id uuid primary key,user_id uuid not null,id uuid not null unique default gen_random_uuid(),
 base_version integer not null,capture jsonb not null,input_identity text,created_at timestamptz not null default now(),
 foreign key(source_id,user_id) references public.sources(id,user_id) on delete cascade,
 check(octet_length(capture::text)<=262144)
);
create table public.source_identities (
 user_id uuid not null,identity text not null,source_id uuid not null,
 primary key(user_id,identity),foreign key(source_id,user_id) references public.sources(id,user_id) on delete cascade
);
alter table public.source_versions enable row level security;
alter table public.source_revision_candidates enable row level security;
alter table public.source_identities enable row level security;
revoke all on public.source_versions,public.source_revision_candidates,public.source_identities from anon,authenticated;
grant select,insert,update,delete on public.source_versions,public.source_revision_candidates,public.source_identities to service_role;

create function public.remember_source_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.source_identities(user_id,identity,source_id) values(new.user_id,new.canonical_url,new.id);
 return new;
end;$$;
revoke execute on function public.remember_source_identity() from public,anon,authenticated;
create trigger source_identity after insert on public.sources for each row execute function public.remember_source_identity();
insert into public.source_identities(user_id,identity,source_id) select user_id,canonical_url,id from public.sources;
create function public.find_source_identity(p_identity text) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(s) from public.source_identities i join public.sources s on s.id=i.source_id and s.user_id=i.user_id
 where i.user_id=auth.uid() and i.identity=p_identity;
$$;

create function public.valid_revision_capture(p_source public.sources,p_capture jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare v_source public.sources;
begin
 if jsonb_typeof(p_capture) is distinct from 'object' or
  (select count(*) from jsonb_object_keys(p_capture))<>6 or
  not(p_capture ?& array['captured_text','capture_origin','coverage','coverage_detail','document','transcript']) or
  jsonb_typeof(p_capture->'captured_text') is distinct from 'string' or
  jsonb_typeof(p_capture->'coverage_detail') is distinct from 'string' then return false;end if;
 v_source:=jsonb_populate_record(p_source,p_capture);
 if char_length(v_source.captured_text) not between 120 and 30000 or char_length(v_source.coverage_detail) not between 1 and 500 or
  v_source.capture_origin is null or v_source.capture_origin not in ('direct','reader','pasted','upload') or
  v_source.coverage is null or v_source.coverage not in ('complete','partial','unknown') then return false;end if;
 return coalesce(
  (v_source.source_kind='article' and v_source.document is null and v_source.transcript is null and v_source.capture_origin<>'upload') or
  (v_source.source_kind='pdf' and v_source.transcript is null and public.valid_pdf_document(v_source.document,v_source.captured_text) and
   ((v_source.original_url is null and v_source.capture_origin='upload' and v_source.document->>'filename' is not null) or
    (v_source.original_url is not null and v_source.capture_origin='direct'))) or
  (v_source.source_kind='video' and v_source.document is null and v_source.coverage in ('unknown','partial') and public.valid_video_transcript(v_source.transcript,v_source.captured_text) and
   v_source.transcript->>'provider'=p_source.transcript->>'provider' and
   ((v_source.capture_origin='pasted' and v_source.transcript->'filename'='null'::jsonb) or
    (v_source.capture_origin='upload' and v_source.transcript->>'filename' is not null) or
    (v_source.capture_origin='direct' and v_source.transcript->'filename'='null'::jsonb and v_source.transcript->>'provider'='youtube' and v_source.transcript->>'format'='vtt'))),false);
exception when others then return false;
end;$$;
revoke execute on function public.valid_revision_capture(public.sources,jsonb) from public,anon,authenticated;

create function public.compare_source_capture(p_source_id uuid,p_capture jsonb,p_input_identity text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.sources;v_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into v_source from public.sources where id=p_source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source not found';end if;
 if not public.valid_revision_capture(v_source,p_capture) or
  (p_input_identity is not null and (v_source.source_kind<>'pdf' or v_source.original_url is not null or p_input_identity!~'^urn:pdf:sha256:[a-f0-9]{64}$')) then
  raise exception using errcode='22023',message='Invalid replacement capture';end if;
 if v_source.captured_text=p_capture->>'captured_text' and
  coalesce(v_source.document-'filename','null'::jsonb)=coalesce(nullif(p_capture->'document','null'::jsonb)-'filename','null'::jsonb) and
  coalesce(v_source.transcript->'segments','null'::jsonb)=coalesce(p_capture->'transcript'->'segments','null'::jsonb) then
  if p_input_identity is not null then
   if exists(select 1 from public.source_identities where user_id=auth.uid() and identity=p_input_identity and source_id<>p_source_id) then raise exception using errcode='23505',message='This file belongs to another saved source';end if;
   insert into public.source_identities(user_id,identity,source_id) values(auth.uid(),p_input_identity,p_source_id) on conflict(user_id,identity) do nothing;
  end if;
  delete from public.source_revision_candidates where source_id=p_source_id;
  return jsonb_build_object('source_id',p_source_id,'base_version',v_source.source_version,'candidate_id',null,'changed',false);
 end if;
 insert into public.source_revision_candidates(source_id,user_id,base_version,capture,input_identity)
 values(p_source_id,auth.uid(),v_source.source_version,p_capture,p_input_identity)
 on conflict(source_id) do update set id=gen_random_uuid(),base_version=excluded.base_version,capture=excluded.capture,input_identity=excluded.input_identity,created_at=now()
 returning id into v_id;
 return jsonb_build_object('source_id',p_source_id,'base_version',v_source.source_version,'candidate_id',v_id,'changed',true);
end;$$;

create function public.confirm_source_refresh(p_source_id uuid,p_candidate_id uuid,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.sources;v_candidate public.source_revision_candidates;v_note jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into v_source from public.sources where id=p_source_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Source not found';end if;
 select * into v_candidate from public.source_revision_candidates where source_id=p_source_id and user_id=auth.uid() and id=p_candidate_id for update;
 if not found or v_candidate.created_at<now()-interval '24 hours' then raise exception using errcode='P0002',message='Check for changes again';end if;
 if v_source.source_version<>p_expected_version or v_candidate.base_version<>p_expected_version then raise exception using errcode='40001',message='Source changed; compare again';end if;
 if v_source.source_version>=20 then raise exception using errcode='54000',message='This source has reached its 20-version limit';end if;
 select to_jsonb(n)-'lease_token'-'lease_until' into v_note from public.source_studies n where source_id=p_source_id;
 insert into public.source_versions(source_id,user_id,version,source,study) values(p_source_id,auth.uid(),v_source.source_version,to_jsonb(v_source),v_note);
 if v_candidate.input_identity is not null then
  if exists(select 1 from public.source_identities where user_id=auth.uid() and identity=v_candidate.input_identity and source_id<>p_source_id) then raise exception using errcode='23505',message='This file belongs to another saved source';end if;
  insert into public.source_identities(user_id,identity,source_id) values(auth.uid(),v_candidate.input_identity,p_source_id) on conflict(user_id,identity) do nothing;
 end if;
 -- Old lease tokens and queue rows disappear atomically with the capture switch.
 delete from public.source_topic_maps where source_id=p_source_id;
 delete from public.source_studies where source_id=p_source_id;
 update public.sources set captured_text=v_candidate.capture->>'captured_text',capture_origin=v_candidate.capture->>'capture_origin',
  coverage=v_candidate.capture->>'coverage',coverage_detail=v_candidate.capture->>'coverage_detail',
  document=nullif(v_candidate.capture->'document','null'::jsonb),transcript=nullif(v_candidate.capture->'transcript','null'::jsonb),
  captured_at=clock_timestamp(),source_version=source_version+1 where id=p_source_id returning * into v_source;
 insert into public.source_studies(source_id,user_id,source_version) values(p_source_id,auth.uid(),v_source.source_version);
 insert into public.study_outbox(source_id) values(p_source_id);
 delete from public.source_revision_candidates where source_id=p_source_id;
 return to_jsonb(v_source);
end;$$;

create function public.get_source_version(p_source_id uuid,p_version integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if not exists(select 1 from public.sources where id=p_source_id and user_id=auth.uid()) then raise exception using errcode='P0002',message='Source not found';end if;
 select jsonb_build_object('source',source,'study',study) into v_result from public.source_versions where source_id=p_source_id and user_id=auth.uid() and version=p_version;
 if v_result is null then raise exception using errcode='P0002',message='Saved version not found';end if;
 return v_result;
end;$$;
create function public.list_source_versions(p_source_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_source public.sources;v_versions jsonb;
begin
 select * into v_source from public.sources where id=p_source_id and user_id=auth.uid();
 if not found then raise exception using errcode='P0002',message='Source not found';end if;
 select coalesce(jsonb_agg(jsonb_build_object('version',version,'captured_at',source->>'captured_at','has_note',coalesce(study->>'status'='succeeded',false)) order by version desc),'[]') into v_versions from public.source_versions where source_id=p_source_id and user_id=auth.uid();
 return jsonb_build_object('source_id',p_source_id,'current_version',v_source.source_version,'versions',v_versions,'correction_review',(select public.apply_topic_rules(auth.uid(),o.analysis) from public.source_topic_overrides o where o.source_id=p_source_id and o.user_id=auth.uid() and o.needs_review));
end;$$;
revoke execute on function public.find_source_identity(text),public.compare_source_capture(uuid,jsonb,text),public.confirm_source_refresh(uuid,uuid,integer),public.get_source_version(uuid,integer),public.list_source_versions(uuid) from public,anon;
grant execute on function public.find_source_identity(text),public.compare_source_capture(uuid,jsonb,text),public.confirm_source_refresh(uuid,uuid,integer),public.get_source_version(uuid,integer),public.list_source_versions(uuid) to authenticated;
-- Preserve the exact evidence behind learner assignments across version changes.
alter table public.source_topic_overrides add column source_version integer not null default 1;
alter table public.source_topic_overrides add column saved_references jsonb not null default '[]';
alter table public.source_topic_overrides add column needs_review boolean not null default false;
update public.source_topic_overrides o set saved_references=coalesce(n.note->'references','[]') from public.source_studies n where n.source_id=o.source_id;

create or replace function public.remember_source_topics() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.analysis is not null and auth.uid()=new.user_id and coalesce(current_setting('app.topic_global',true),'false')<>'true' then
  insert into public.source_topic_overrides(source_id,user_id,analysis,source_version,saved_references,needs_review)
   select new.source_id,new.user_id,new.analysis,s.source_version,n.note->'references',false
   from public.sources s join public.source_studies n on n.source_id=s.id where s.id=new.source_id
  on conflict(source_id) do update set analysis=excluded.analysis,source_version=excluded.source_version,saved_references=excluded.saved_references,needs_review=false;
 end if;
 return new;
end;$$;

create function public.reanchor_source_override(p_source_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_override public.source_topic_overrides;v_version integer;v_refs jsonb;v_remap jsonb:='{}';v_ref jsonb;v_match jsonb;v_ids jsonb;v_topics jsonb:='[]';v_relations jsonb:='[]';v_item jsonb;
begin
 select * into v_override from public.source_topic_overrides where source_id=p_source_id;
 if not found then return null;end if;
 select s.source_version,n.note->'references' into v_version,v_refs from public.sources s join public.source_studies n on n.source_id=s.id where s.id=p_source_id and n.status='succeeded';
 if v_override.source_version=v_version then return v_override.analysis;end if;
 for v_ref in select r from jsonb_array_elements(v_override.saved_references) r loop
  -- An ambiguous repeated excerpt cannot silently select a different page/time.
  if (select count(*) from jsonb_array_elements(v_refs) r where r->>'excerpt'=v_ref->>'excerpt')=1 then
   select r into v_match from jsonb_array_elements(v_refs) r where r->>'excerpt'=v_ref->>'excerpt';
   v_remap:=v_remap||jsonb_build_object(v_ref->>'id',v_match->>'id');
  end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(v_override.analysis->'topics') t,lateral jsonb_array_elements_text(t->'citation_ids') c where not(v_remap ? c)) or
  exists(select 1 from jsonb_array_elements(v_override.analysis->'relations') r,lateral jsonb_array_elements_text(r->'citation_ids') c where not(v_remap ? c)) then
  update public.source_topic_overrides set needs_review=true where source_id=p_source_id;
  return null;
 end if;
 for v_item in select t from jsonb_array_elements(v_override.analysis->'topics') t loop
  select jsonb_agg(v_remap->c) into v_ids from jsonb_array_elements_text(v_item->'citation_ids') c;
  v_topics:=v_topics||jsonb_build_array(v_item||jsonb_build_object('citation_ids',v_ids));
 end loop;
 for v_item in select r from jsonb_array_elements(v_override.analysis->'relations') r loop
  select jsonb_agg(v_remap->c) into v_ids from jsonb_array_elements_text(v_item->'citation_ids') c;
  v_relations:=v_relations||jsonb_build_array(v_item||jsonb_build_object('citation_ids',v_ids));
 end loop;
 v_override.analysis:=v_override.analysis||jsonb_build_object('topics',v_topics,'relations',v_relations);
 update public.source_topic_overrides set analysis=v_override.analysis,source_version=v_version,saved_references=v_refs,needs_review=false where source_id=p_source_id;
 return v_override.analysis;
end;$$;
revoke execute on function public.reanchor_source_override(uuid) from public,anon,authenticated;

create or replace function public.enforce_topic_rules() returns trigger language plpgsql security definer set search_path='' as $$
declare v_override jsonb;
begin
 if new.analysis is not null then
  if auth.uid() is distinct from new.user_id and exists(select 1 from public.source_topic_overrides where source_id=new.source_id) then
   v_override:=public.reanchor_source_override(new.source_id);
   if v_override is null then
    new.analysis:=null;new.status:='failed';new.error_code:='invalid_output';new.lease_token:=null;new.lease_until:=null;
    return new;
   end if;
   new.analysis:=v_override;
  end if;
  new.analysis:=public.apply_topic_rules(new.user_id,new.analysis);
  if exists(select 1 from jsonb_array_elements(new.analysis->'topics') t,lateral jsonb_array_elements_text(t->'citation_ids') c
   where not exists(select 1 from public.source_studies s,lateral jsonb_array_elements(s.note->'references') r where s.source_id=new.source_id and s.user_id=new.user_id and r->>'id'=c)) then
   raise exception using errcode='22023',message='Topic evidence unavailable';
  end if;
 end if;
 return new;
end;$$;

create function public.review_source_assignments(p_source_id uuid,p_topic_ids uuid[],p_evidence_ids text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_override public.source_topic_overrides;v_topics jsonb:='[]';v_topic jsonb;v_id uuid;v_analysis jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select * into v_override from public.source_topic_overrides where source_id=p_source_id and user_id=v_user and needs_review for update;
 if not found then raise exception using errcode='P0002',message='Correction review unavailable';end if;
 if coalesce(cardinality(p_topic_ids),0) not between 1 and 12 or coalesce(cardinality(p_evidence_ids),0) not between 1 and 10 or
  (select count(distinct x) from unnest(p_topic_ids) x)<>cardinality(p_topic_ids) or
  (select count(distinct x) from unnest(p_evidence_ids) x)<>cardinality(p_evidence_ids) or
  exists(select 1 from unnest(p_evidence_ids) c where length(c) not between 1 and 16 or not exists(select 1 from public.source_studies n,lateral jsonb_array_elements(n.note->'references') r where n.source_id=p_source_id and n.user_id=v_user and n.status='succeeded' and r->>'id'=c)) then raise exception using errcode='22023',message='Choose current supporting passages';end if;
 v_analysis:=public.apply_topic_rules(v_user,v_override.analysis);
 foreach v_id in array p_topic_ids loop
  select t into v_topic from jsonb_array_elements(v_analysis->'topics') t where t->>'id'=v_id::text;
  if v_topic is null then raise exception using errcode='P0002',message='Corrected topic unavailable';end if;
  v_topics:=v_topics||jsonb_build_array(v_topic||jsonb_build_object('citation_ids',to_jsonb(p_evidence_ids),'uncertain',false,'suggested_topic_id',null,'placement_reason','Source assignment corrected by the learner.'));
 end loop;
 if not exists(select 1 from jsonb_array_elements(v_topics) t where t->>'role'='main') then v_topics:=jsonb_set(v_topics,'{0,role}','"main"');end if;
 -- Connections need fresh supporting evidence; do not replay old relations.
 update public.source_topic_maps set status='succeeded',analysis=jsonb_build_object('topics',v_topics,'relations','[]'::jsonb,'catalog_partial',false),
  error_code=null,lease_token=null,lease_until=null,updated_at=clock_timestamp() where source_id=p_source_id and user_id=v_user;
 if not found then raise exception using errcode='P0002',message='Topic mapping unavailable';end if;
 delete from public.topic_outbox where source_id=p_source_id;
 return true;
end;$$;
revoke execute on function public.review_source_assignments(uuid,uuid[],text[]) from public,anon;
grant execute on function public.review_source_assignments(uuid,uuid[],text[]) to authenticated;

create or replace function public.claim_source_study(p_source_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare v_user uuid;v_study public.source_studies; v_text text; v_document jsonb; v_transcript jsonb;
begin
  select user_id into v_user from public.sources where id=p_source_id;
  if not found then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  select * into v_study from public.source_studies
    where source_id = p_source_id and status = 'queued' and attempts < max_attempts
      and next_attempt_at <= now() for update skip locked;
  if not found then return null; end if;
  update public.source_studies set status = 'processing',attempts = attempts + 1,
    lease_token = gen_random_uuid(),lease_until = now() + interval '120 seconds',
    error_code = null,updated_at = now() where source_id = p_source_id returning * into v_study;
  select captured_text,document,transcript into v_text,v_document,v_transcript from public.sources where id = p_source_id;
  return jsonb_build_object('source_id',p_source_id,'user_id',v_study.user_id,
    'captured_text',v_text,'document',v_document,'transcript',v_transcript,'lease_token',v_study.lease_token,'attempt',v_study.attempts);
end;
$$;
create or replace function public.finish_source_study(p_source_id uuid,p_lease_token uuid,p_note jsonb,p_error_code text)
returns boolean language plpgsql set search_path = '' as $$
declare v_user uuid;v_study public.source_studies;
begin
  select user_id into v_user from public.sources where id=p_source_id;
  if not found then return false;end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  if (p_note is null) = (p_error_code is null) then
    raise exception 'Provide either a validated note or an error code';
  end if;
  select * into v_study from public.source_studies where source_id = p_source_id
    and status = 'processing' and lease_token = p_lease_token and lease_until > now() for update;
  if not found then return false; end if;
  if p_note is not null then
    update public.source_studies set status = 'succeeded',note = p_note,
      error_code = null,lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id;
    delete from public.study_outbox where source_id = p_source_id;
  else
    update public.source_studies set
      status = case when attempts >= max_attempts or p_error_code = 'setup_required' then 'failed' else 'queued' end,
      note = null,error_code = p_error_code,lease_token = null,lease_until = null,
      next_attempt_at = now() + make_interval(secs => case when attempts = 1 then 10 else 30 end),
      updated_at = now() where source_id = p_source_id returning * into v_study;
    if v_study.status = 'queued' then
      update public.study_outbox set next_delivery_at = v_study.next_attempt_at where source_id = p_source_id;
    else
      delete from public.study_outbox where source_id = p_source_id;
    end if;
  end if;
  return true;
end;
$$;
create or replace function public.request_source_study(p_source_id uuid, p_retry boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_version integer;
  v_study public.source_studies;
begin
  select user_id,source_version into v_user_id,v_version from public.sources
    where id = p_source_id and user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Source not found';
  end if;
  insert into public.source_studies(source_id,user_id,source_version)
    values (p_source_id,v_user_id,v_version) on conflict (source_id) do nothing;
  select * into v_study from public.source_studies where source_id = p_source_id for update;
  if v_study.status = 'failed' and p_retry then
    update public.source_studies set status = 'queued',attempts = 0,
      next_attempt_at = now(),error_code = null,note = null,
      lease_token = null,lease_until = null,updated_at = now()
      where source_id = p_source_id returning * into v_study;
  end if;
  if v_study.status = 'queued' then
    insert into public.study_outbox(source_id,next_delivery_at)
      values (p_source_id,v_study.next_attempt_at) on conflict (source_id) do nothing;
  end if;
  -- Lease fields belong to the worker, not the learner response.
  return to_jsonb(v_study) - 'lease_token' - 'lease_until';
end;
$$;
commit;
