-- Stop new section work safely; retain captures, archives and version fences.
begin;
revoke execute on function public.plan_source_study(uuid,integer,uuid,integer),public.save_study_section(uuid,integer,uuid,integer,jsonb) from service_role;
-- Retain expanded text/selection validators: stored sources cannot be narrowed safely.
-- Keep the matching worker stopped until these grants are restored.
commit;
