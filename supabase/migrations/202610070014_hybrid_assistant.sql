-- Authenticated inventory and exact capture loading; Qdrant remains derived.
begin;
create function public.get_assistant_search_inventory(p_source_id uuid,p_source_version integer,p_topic_id uuid default null,p_library boolean default false)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare v_user uuid:=auth.uid();v_result jsonb;
begin
 if v_user is null then raise exception using errcode='42501',message='Library session required';end if;
 if p_source_version is null or p_source_version not between 1 and 20 or p_library is null then
  raise exception using errcode='22023',message='Invalid assistant scope';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 if not exists(select 1 from public.sources s join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id
  where s.id=p_source_id and s.user_id=v_user and s.source_version=p_source_version and n.source_version=s.source_version and n.status='succeeded') then
  raise exception using errcode='P0002',message='Current completed note unavailable';end if;
 if p_topic_id is not null and not exists(select 1 from public.source_topic_maps m,public.sources s,lateral jsonb_array_elements(m.analysis->'topics') t
  where m.source_id=p_source_id and s.id=m.source_id and s.user_id=v_user and m.user_id=v_user
   and m.status='succeeded' and t->>'id'=p_topic_id::text and t->>'uncertain'='false') then
  raise exception using errcode='P0002',message='Confirmed topic unavailable';end if;
 with eligible as (
  select s.id source_id,s.user_id,s.source_version,n.updated_at study_updated_at,
   case when p_topic_id is not null then m.updated_at else null end map_updated_at,
   encode(sha256(convert_to(s.captured_text,'UTF8')),'hex') capture_sha256,
   case when s.id=p_source_id then 'note'
    when p_topic_id is not null and m.status='succeeded' and exists(
     select 1 from jsonb_array_elements(m.analysis->'topics') t where t->>'id'=p_topic_id::text and t->>'uncertain'='false') then 'topic'
    else 'library' end scope
  from public.sources s join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id
  left join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id
  where s.user_id=v_user and n.status='succeeded' and n.source_version=s.source_version
 ), scoped as (
  select * from eligible where source_id=p_source_id or scope='topic' or p_library
  order by (source_id=p_source_id) desc,source_id limit 201
 ), inventory as (
  select e.*,case when r.status='ready' and r.action='index' and r.source_version=e.source_version
     and r.capture_sha256=e.capture_sha256 and r.chunk_policy='structure_recursive_v1'
     and r.embedding_model='text-embedding-3-small' and r.embedding_dimensions=1536
     and r.collection_name='web_sources_recursive_v1_openai_small_1536'
     and r.chunks_total>0 and r.chunks_completed=r.chunks_total then r.generation else null end generation,
   r.chunks_total from scoped e left join public.retrieval_indexes r on r.source_id=e.source_id and r.user_id=e.user_id
 )
 select jsonb_agg(jsonb_build_object('source_id',source_id,'user_id',user_id,'source_version',source_version,
   'scope',scope,'study_updated_at',study_updated_at,'map_updated_at',map_updated_at,
   'capture_sha256',capture_sha256,'generation',generation,
   'chunks_total',case when generation is not null then chunks_total else 0 end)
   order by (source_id=p_source_id) desc,source_id) into v_result from inventory;
 if jsonb_array_length(v_result)>200 then raise exception using errcode='22023',message='Selected scope exceeds 200 completed sources';end if;
 return v_result;
end;$$;

create function public.validate_hybrid_assistant_context(p_source_id uuid,p_source_version integer,p_topic_id uuid,p_library boolean,p_sources jsonb)
returns boolean language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare v_inventory jsonb;v_item jsonb;v_count integer;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Library session required';end if;
 if jsonb_typeof(p_sources) is distinct from 'array' then return false;end if;
 v_count:=jsonb_array_length(p_sources);
 if v_count not between 1 and 9 or p_sources->0->>'source_id' is distinct from p_source_id::text
  or p_sources->0->>'scope' is distinct from 'note' then return false;end if;
 if (select count(distinct x->>'source_id') from jsonb_array_elements(p_sources) x)<>v_count
  or (select count(*) from jsonb_array_elements(p_sources) x where x->>'scope'='topic')>4
  or (select count(*) from jsonb_array_elements(p_sources) x where x->>'scope'='library')>4 then return false;end if;
 begin
  v_inventory:=public.get_assistant_search_inventory(p_source_id,p_source_version,p_topic_id,p_library);
 exception when no_data_found then return false;end;
 for v_item in select value from jsonb_array_elements(p_sources) loop
  if not (v_item ?& array['study_updated_at','map_updated_at']) or not exists(
   select 1 from jsonb_array_elements(v_inventory) i
   where (i-'study_updated_at'-'map_updated_at')=(v_item-'study_updated_at'-'map_updated_at')
    and (i->>'study_updated_at')::timestamptz=(v_item->>'study_updated_at')::timestamptz
    and (i->>'map_updated_at')::timestamptz is not distinct from (v_item->>'map_updated_at')::timestamptz
  ) then return false;end if;
  -- Only the mandatory current-note placeholder can lack a ready index.
  if v_item->>'scope'<>'note' and v_item->>'generation' is null then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return false;
end;$$;

create function public.get_hybrid_assistant_context(p_source_id uuid,p_source_version integer,p_topic_id uuid,p_library boolean,p_sources jsonb)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare v_result jsonb;
begin
 if not public.validate_hybrid_assistant_context(p_source_id,p_source_version,p_topic_id,p_library,p_sources) then
  raise exception using errcode='40001',message='Selected search evidence changed';end if;
 select jsonb_agg(jsonb_build_object('source_id',s.id,'user_id',s.user_id,'title',s.title,
  'source_version',s.source_version,'captured_text',s.captured_text,'document',s.document,'transcript',s.transcript,
  'note',n.note,'study_updated_at',n.updated_at,
  'map_updated_at',case when p_topic_id is not null then m.updated_at else null end,'scope',x.value->>'scope') order by x.ordinality)
 into v_result from jsonb_array_elements(p_sources) with ordinality x(value,ordinality)
 join public.sources s on s.id::text=x.value->>'source_id' and s.user_id=auth.uid()
 join public.source_studies n on n.source_id=s.id and n.user_id=s.user_id and n.source_version=s.source_version and n.status='succeeded'
 left join public.source_topic_maps m on m.source_id=s.id and m.user_id=s.user_id;
 if jsonb_array_length(v_result) is distinct from jsonb_array_length(p_sources) then
  raise exception using errcode='40001',message='Selected search evidence changed';end if;
 return v_result;
end;$$;
revoke execute on function public.get_assistant_search_inventory(uuid,integer,uuid,boolean),
 public.validate_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb),
 public.get_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb) from public,anon,service_role;
grant execute on function public.get_assistant_search_inventory(uuid,integer,uuid,boolean),
 public.validate_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb),
 public.get_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb) to authenticated;
commit;
