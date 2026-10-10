-- Disable new captured previews; retain readable plans, metadata and redaction.
begin;
revoke execute on function public.request_learning_capture_preview(uuid,integer,uuid,text,text,uuid) from authenticated;
revoke execute on function public.finish_learning_capture_preview(uuid,uuid,jsonb,text,jsonb,text,jsonb,jsonb) from service_role;
commit;
