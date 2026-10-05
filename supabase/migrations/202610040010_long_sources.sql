-- Browser-only long captures, original-location ranges and durable section work.
begin;
alter table public.sources drop constraint sources_captured_text_check;
alter table public.sources add constraint sources_captured_text_check check(char_length(captured_text) between 120 and 120000);
alter table public.source_revision_candidates drop constraint source_revision_candidates_capture_check;
alter table public.source_revision_candidates add constraint source_revision_candidates_capture_check check(octet_length(capture::text)<=1100000);
create or replace function public.valid_pdf_document(p_document jsonb,p_text text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_page jsonb; v_count integer; v_index integer := 0; v_end integer := -1; v_start integer; v_last integer; v_first integer:=1; v_selected_end integer;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
    or octet_length(p_document::text) > 16384
    or (select count(*) from jsonb_object_keys(p_document)) not in (3,4)
    or (p_document - array['filename','page_count','pages','selected_pages']) <> '{}'::jsonb
    or not (p_document ?& array['filename','page_count','pages'])
    or jsonb_typeof(p_document->'page_count') <> 'number'
    or not ((p_document->>'page_count') ~ '^[0-9]+$')
    or jsonb_typeof(p_document->'pages') <> 'array' then return false; end if;
  if p_document->'filename' <> 'null'::jsonb and
    (jsonb_typeof(p_document->'filename') <> 'string' or char_length(p_document->>'filename') not between 1 and 200) then return false; end if;
  v_count := (p_document->>'page_count')::integer;
  if v_count not between 1 and 100 or jsonb_array_length(p_document->'pages') not between 1 and v_count then return false; end if;
  if p_document->'selected_pages' is not null and p_document->'selected_pages'<>'null'::jsonb then
    if jsonb_typeof(p_document->'selected_pages') is distinct from 'object' or
      ((p_document->'selected_pages') - array['start','end'])<>'{}'::jsonb or
      not(p_document->'selected_pages' ?& array['start','end']) or
      jsonb_typeof(p_document->'selected_pages'->'start') is distinct from 'number' or
      jsonb_typeof(p_document->'selected_pages'->'end') is distinct from 'number' or
      not((p_document->'selected_pages'->>'start')~'^[0-9]+$' and (p_document->'selected_pages'->>'end')~'^[0-9]+$') then return false;end if;
    v_first:=(p_document->'selected_pages'->>'start')::integer;
    v_selected_end:=(p_document->'selected_pages'->>'end')::integer;
    if not(1<=v_first and v_first<=v_selected_end and v_selected_end<=v_count) then return false;end if;
  else v_selected_end:=v_count;end if;
  if jsonb_array_length(p_document->'pages')>v_selected_end-v_first+1 then return false;end if;
  for v_page in select value from jsonb_array_elements(p_document->'pages') loop
    v_index := v_index + 1;
    if jsonb_typeof(v_page) <> 'object' or (select count(*) from jsonb_object_keys(v_page)) <> 3
      or not (v_page ?& array['page','start','end'])
      or jsonb_typeof(v_page->'page') <> 'number' or jsonb_typeof(v_page->'start') <> 'number' or jsonb_typeof(v_page->'end') <> 'number'
      or not ((v_page->>'page') ~ '^[0-9]+$' and (v_page->>'start') ~ '^[0-9]+$' and (v_page->>'end') ~ '^[0-9]+$') then return false; end if;
    v_start := (v_page->>'start')::integer; v_last := (v_page->>'end')::integer;
    if (v_page->>'page')::integer <> v_index+v_first-1 or v_start <> v_end + 1 or v_last < v_start or v_last > char_length(p_text) then return false; end if;
    v_end := v_last;
  end loop;
  return v_end = char_length(p_text);
exception when others then return false;
end;
$$;

create or replace function public.valid_video_transcript(p_transcript jsonb,p_text text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_segment jsonb; v_format text; v_end integer := -1; v_start integer; v_last integer;
  v_time integer := -1; v_start_ms integer; v_end_ms integer; v_selected_start integer; v_selected_end integer;
begin
  if p_transcript is null or jsonb_typeof(p_transcript) <> 'object'
    or octet_length(p_transcript::text) > 256000
    or (select count(*) from jsonb_object_keys(p_transcript)) not in (4,5)
    or (p_transcript - array['provider','format','filename','segments','selected_time']) <> '{}'::jsonb
    or not (p_transcript ?& array['provider','format','filename','segments'])
    or jsonb_typeof(p_transcript->'provider') <> 'string'
    or p_transcript->>'provider' not in ('youtube','teams','zoom','panopto')
    or jsonb_typeof(p_transcript->'format') <> 'string'
    or p_transcript->>'format' not in ('text','vtt','srt')
    or jsonb_typeof(p_transcript->'segments') <> 'array'
    or jsonb_array_length(p_transcript->'segments') not between 1 and 2000 then return false; end if;
  if p_transcript->'filename' <> 'null'::jsonb and
    (jsonb_typeof(p_transcript->'filename') <> 'string' or char_length(p_transcript->>'filename') not between 1 and 200) then return false; end if;
  v_format := p_transcript->>'format';
  if v_format = 'text' and jsonb_array_length(p_transcript->'segments') <> 1 then return false; end if;
  if p_transcript->'selected_time' is not null and p_transcript->'selected_time'<>'null'::jsonb then
    if v_format='text' or jsonb_typeof(p_transcript->'selected_time') is distinct from 'object' or
      ((p_transcript->'selected_time') - array['start_ms','end_ms'])<>'{}'::jsonb or
      not(p_transcript->'selected_time' ?& array['start_ms','end_ms']) or
      jsonb_typeof(p_transcript->'selected_time'->'start_ms') is distinct from 'number' or
      jsonb_typeof(p_transcript->'selected_time'->'end_ms') is distinct from 'number' or
      not((p_transcript->'selected_time'->>'start_ms')~'^[0-9]+$' and (p_transcript->'selected_time'->>'end_ms')~'^[0-9]+$') then return false;end if;
    v_selected_start:=(p_transcript->'selected_time'->>'start_ms')::integer;
    v_selected_end:=(p_transcript->'selected_time'->>'end_ms')::integer;
    if not(0<=v_selected_start and v_selected_start<v_selected_end and v_selected_end<=604800000) then return false;end if;
  end if;
  for v_segment in select value from jsonb_array_elements(p_transcript->'segments') loop
    if jsonb_typeof(v_segment) <> 'object' or (select count(*) from jsonb_object_keys(v_segment)) <> 4
      or not (v_segment ?& array['start','end','start_ms','end_ms'])
      or jsonb_typeof(v_segment->'start') <> 'number' or jsonb_typeof(v_segment->'end') <> 'number'
      or not ((v_segment->>'start') ~ '^[0-9]+$' and (v_segment->>'end') ~ '^[0-9]+$') then return false; end if;
    v_start := (v_segment->>'start')::integer; v_last := (v_segment->>'end')::integer;
    if v_start <> v_end + 1 or v_last <= v_start or v_last > char_length(p_text) then return false; end if;
    if v_format = 'text' then
      if v_segment->'start_ms' <> 'null'::jsonb or v_segment->'end_ms' <> 'null'::jsonb then return false; end if;
    else
      if jsonb_typeof(v_segment->'start_ms') <> 'number' or jsonb_typeof(v_segment->'end_ms') <> 'number'
        or not ((v_segment->>'start_ms') ~ '^[0-9]+$' and (v_segment->>'end_ms') ~ '^[0-9]+$') then return false; end if;
      v_start_ms := (v_segment->>'start_ms')::integer; v_end_ms := (v_segment->>'end_ms')::integer;
      if v_start_ms < v_time or v_end_ms <= v_start_ms or v_end_ms > 604800000 then return false; end if;
      if v_selected_start is not null and (v_start_ms>=v_selected_end or v_end_ms<=v_selected_start) then return false;end if;
      v_time := v_start_ms;
    end if;
    v_end := v_last;
  end loop;
  return v_end = char_length(p_text);
exception when others then return false;
end;
$$;

create or replace function public.valid_revision_capture(p_source public.sources,p_capture jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare v_source public.sources;
begin
 if jsonb_typeof(p_capture) is distinct from 'object' or
  (select count(*) from jsonb_object_keys(p_capture))<>6 or
  not(p_capture ?& array['captured_text','capture_origin','coverage','coverage_detail','document','transcript']) or
  jsonb_typeof(p_capture->'captured_text') is distinct from 'string' or
  jsonb_typeof(p_capture->'coverage_detail') is distinct from 'string' then return false;end if;
 v_source:=jsonb_populate_record(p_source,p_capture);
 if char_length(v_source.captured_text) not between 120 and 120000 or char_length(v_source.coverage_detail) not between 1 and 500 or
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

create or replace function public.compare_source_capture(p_source_id uuid,p_capture jsonb,p_input_identity text default null)
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
  coalesce(jsonb_strip_nulls(v_source.document-'filename'),'null'::jsonb)=coalesce(jsonb_strip_nulls(nullif(p_capture->'document','null'::jsonb)-'filename'),'null'::jsonb) and
  coalesce(v_source.transcript->'segments','null'::jsonb)=coalesce(p_capture->'transcript'->'segments','null'::jsonb) and
  coalesce(v_source.transcript->'selected_time','null'::jsonb)=coalesce(p_capture->'transcript'->'selected_time','null'::jsonb) then
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

alter table public.source_studies add column sections_total integer not null default 0 check(sections_total between 0 and 20);
alter table public.source_studies add column sections_completed integer not null default 0 check(sections_completed between 0 and sections_total);
create table public.study_sections (
 source_id uuid not null references public.source_studies(source_id) on delete cascade,
 source_version integer not null check(source_version between 1 and 20),
 section_index integer not null check(section_index between 0 and 19),
 summary jsonb not null check(jsonb_typeof(summary)='object' and octet_length(summary::text)<=8192),
 primary key(source_id,source_version,section_index)
);
alter table public.study_sections enable row level security;
revoke all on public.study_sections from public,anon,authenticated;
grant select,insert,update,delete on public.study_sections to service_role;

create function public.plan_source_study(p_source_id uuid,p_source_version integer,p_lease_token uuid,p_total integer)
returns boolean language plpgsql set search_path='' as $$
declare v_user uuid;v_study public.source_studies;
begin
 select user_id into v_user from public.sources where id=p_source_id;
 if not found then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select * into v_study from public.source_studies where source_id=p_source_id and source_version=p_source_version
  and status='processing' and lease_token=p_lease_token and lease_until>now() for update;
 if not found then return false;end if;
 if p_total is null or p_total not between 1 and 20 or (v_study.sections_total<>0 and v_study.sections_total<>p_total) then
  raise exception using errcode='22023',message='Invalid section plan';end if;
 update public.source_studies set sections_total=p_total,lease_until=clock_timestamp()+interval '120 seconds',updated_at=clock_timestamp() where source_id=p_source_id;
 return true;
end;$$;

create function public.save_study_section(p_source_id uuid,p_source_version integer,p_lease_token uuid,p_index integer,p_summary jsonb)
returns boolean language plpgsql set search_path='' as $$
declare v_user uuid;v_study public.source_studies;v_id jsonb;v_previous jsonb;
begin
 select user_id into v_user from public.sources where id=p_source_id;
 if not found then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select * into v_study from public.source_studies where source_id=p_source_id and source_version=p_source_version
  and status='processing' and lease_token=p_lease_token and lease_until>now() for update;
 if not found then return false;end if;
 if p_index is null or p_index<0 or p_index>=v_study.sections_total or p_index>v_study.sections_completed or
  jsonb_typeof(p_summary) is distinct from 'object' or (p_summary-array['text','citation_ids'])<>'{}'::jsonb or
  not(p_summary ?& array['text','citation_ids']) or jsonb_typeof(p_summary->'text') is distinct from 'string' or
  char_length(p_summary->>'text') not between 1 and 1200 or jsonb_typeof(p_summary->'citation_ids') is distinct from 'array' or
  jsonb_array_length(p_summary->'citation_ids') not between 1 and 10 then
  raise exception using errcode='22023',message='Invalid section summary';end if;
 for v_id in select value from jsonb_array_elements(p_summary->'citation_ids') loop
  if jsonb_typeof(v_id) is distinct from 'string' or (v_id #>> '{}')!~'^p[0-9]{4}$' then
   raise exception using errcode='22023',message='Invalid section citation';end if;
 end loop;
 if p_index<v_study.sections_completed then
  select summary into v_previous from public.study_sections where source_id=p_source_id and source_version=p_source_version and section_index=p_index;
  if v_previous is distinct from p_summary then raise exception using errcode='22023',message='Section already saved';end if;
 else
  insert into public.study_sections(source_id,source_version,section_index,summary) values(p_source_id,p_source_version,p_index,p_summary);
  update public.source_studies set sections_completed=sections_completed+1 where source_id=p_source_id;
 end if;
 update public.source_studies set lease_until=clock_timestamp()+interval '120 seconds',updated_at=clock_timestamp() where source_id=p_source_id;
 return true;
end;$$;
revoke execute on function public.plan_source_study(uuid,integer,uuid,integer),public.save_study_section(uuid,integer,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.plan_source_study(uuid,integer,uuid,integer),public.save_study_section(uuid,integer,uuid,integer,jsonb) to service_role;

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
    'source_version',v_study.source_version,
    'completed_sections',(select coalesce(jsonb_agg(summary order by section_index),'[]') from public.study_sections where source_id=p_source_id and source_version=v_study.source_version),
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
    if v_study.sections_total<1 or v_study.sections_completed<>v_study.sections_total then
      raise exception using errcode='22023',message='All sections must complete before synthesis';end if;
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

commit;
