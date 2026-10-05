-- Read-only assistant context; conversations and model credentials stay off Postgres.
begin;
create index source_studies_assistant_search on public.source_studies
 using gin(to_tsvector('english'::regconfig,note::text)) where status='succeeded';

create function public.get_assistant_context(p_source_id uuid,p_source_version integer,p_question text,p_topic_id uuid default null,p_library boolean default false)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare v_user uuid:=auth.uid();v_result jsonb;v_query tsquery;
begin
 if v_user is null then raise exception using errcode='42501',message='Library session required';end if;
 if p_question is null or length(btrim(p_question)) not between 1 and 2000 or p_source_version is null or p_source_version not between 1 and 20 or p_library is null then
  raise exception using errcode='22023',message='Invalid assistant request';
 end if;
 v_query:=(select coalesce(string_agg(quote_literal(term),' | '),'')::tsquery from unnest(tsvector_to_array(to_tsvector('english'::regconfig,p_question))) term);
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 if not exists(select 1 from public.sources s join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id
  where s.id=p_source_id and s.user_id=v_user and s.source_version=p_source_version and n.source_version=s.source_version and n.status='succeeded') then
  raise exception using errcode='P0002',message='Current completed note unavailable';
 end if;
 if p_topic_id is not null and not exists(select 1 from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t
  where m.source_id=p_source_id and m.user_id=v_user and m.status='succeeded' and t->>'id'=p_topic_id::text and t->>'uncertain'='false') then
  raise exception using errcode='P0002',message='Confirmed topic unavailable';
 end if;
 with candidates as (
  select s.id source_id,s.user_id,s.title,s.source_version,s.captured_text,s.document,s.transcript,n.note,n.updated_at study_updated_at,
   case when p_topic_id is not null then m.updated_at else null end map_updated_at,
   coalesce(p_topic_id is not null and m.status='succeeded' and exists(select 1 from jsonb_array_elements(m.analysis->'topics') t where t->>'id'=p_topic_id::text and t->>'uncertain'='false'),false) topic_match,
   ts_rank_cd(to_tsvector('english'::regconfig,n.note::text),v_query) rank
  from public.sources s join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id
  left join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id
  where s.user_id=v_user and n.status='succeeded' and n.source_version=s.source_version
 ), topic_rows as (
  select * from candidates where source_id<>p_source_id and topic_match order by rank desc,source_id limit 4
 ), library_rows as (
  select * from candidates where p_library and rank>0 and source_id<>p_source_id and source_id not in(select source_id from topic_rows)
  order by rank desc,source_id limit 4
 ), chosen as (
  select *, 'note'::text scope,0 priority from candidates where source_id=p_source_id
  union all select *, 'topic',1 from topic_rows
  union all select *, 'library',2 from library_rows
 )
 select jsonb_agg(jsonb_build_object('source_id',source_id,'user_id',user_id,'title',title,'source_version',source_version,
  'captured_text',captured_text,'document',document,'transcript',transcript,'note',note,'study_updated_at',study_updated_at,'map_updated_at',map_updated_at,'scope',scope)
  order by priority,rank desc,source_id) into v_result from chosen;
 return v_result;
end;
$$;

create function public.validate_assistant_context(p_source_id uuid,p_topic_id uuid,p_sources jsonb)
returns boolean language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare v_user uuid:=auth.uid();v_item jsonb;v_count integer;v_found integer:=0;
begin
 if v_user is null then raise exception using errcode='42501',message='Library session required';end if;
 if jsonb_typeof(p_sources) is distinct from 'array' then return false;end if;
 v_count:=jsonb_array_length(p_sources);
 if v_count not between 1 and 9 or (p_sources->0->>'source_id')::uuid is distinct from p_source_id or p_sources->0->>'scope' is distinct from 'note' then return false;end if;
 if (select count(distinct x->>'source_id') from jsonb_array_elements(p_sources) x)<>v_count then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 if p_topic_id is not null and not exists(select 1 from public.source_topic_maps m,lateral jsonb_array_elements(m.analysis->'topics') t
  where m.user_id=v_user and m.source_id=p_source_id and m.status='succeeded' and t->>'id'=p_topic_id::text and t->>'uncertain'='false') then return false;end if;
 for v_item in select value from jsonb_array_elements(p_sources) loop
  if not exists(select 1 from public.sources s join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id
    left join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id
    where s.user_id=v_user and s.id=(v_item->>'source_id')::uuid and s.source_version=(v_item->>'source_version')::integer
     and n.source_version=s.source_version and n.status='succeeded' and n.updated_at=(v_item->>'study_updated_at')::timestamptz
     and (p_topic_id is null or m.updated_at is not distinct from (v_item->>'map_updated_at')::timestamptz)
     and (v_item->>'scope'<>'topic' or p_topic_id is not null and m.status='succeeded' and exists(select 1 from jsonb_array_elements(m.analysis->'topics') t where t->>'id'=p_topic_id::text and t->>'uncertain'='false'))
  ) then return false;end if;
  v_found:=v_found+1;
 end loop;
 return v_found=v_count;
end;
$$;
revoke execute on function public.get_assistant_context(uuid,integer,text,uuid,boolean),public.validate_assistant_context(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.get_assistant_context(uuid,integer,text,uuid,boolean),public.validate_assistant_context(uuid,uuid,jsonb) to authenticated;
commit;
