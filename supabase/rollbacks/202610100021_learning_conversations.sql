-- Pause generation; retain conversations, reads, clearing, exports and redaction.
begin;
revoke execute on function public.request_learning_conversation(uuid,uuid,integer,uuid,text,bigint) from authenticated;
revoke execute on function public.finish_learning_conversation(uuid,uuid,jsonb,text) from service_role;
commit;
