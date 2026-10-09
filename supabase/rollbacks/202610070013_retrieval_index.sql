-- Stop indexing workers first. Preserve manifests/tombstones for restart/cleanup.
begin;
drop trigger if exists source_retrieval_index on public.sources;
revoke execute on function public.get_retrieval_index_status(uuid) from authenticated;
revoke execute on function public.due_retrieval_indexes(integer),public.claim_retrieval_index(uuid),
 public.checkpoint_retrieval_index(uuid,uuid,uuid,integer,integer),public.finish_retrieval_index(uuid,uuid,uuid,text) from service_role;
commit;
