-- Forward-compatible recovery: keep learner text and read/bookmark access.
begin;
revoke execute on function public.save_learning_draft(uuid,uuid,integer,text,text,bigint,uuid) from authenticated;
commit;
-- Restore writes after repair by granting this function to authenticated again.
-- Do not drop learning_drafts or export/deletion history as a default rollback.
