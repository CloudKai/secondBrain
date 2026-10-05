-- Disable new comparisons/promotions without losing learner captures/history.
-- Keep version readers, aliases and evidence review usable for existing revisions.
begin;
revoke execute on function public.compare_source_capture(uuid,jsonb,text),
 public.confirm_source_refresh(uuid,uuid,integer) from authenticated;
-- Re-enable with GRANT EXECUTE on the same signatures; no schema reapplication.
-- Version-aware correction and owner-before-row worker fences remain required.
commit;
