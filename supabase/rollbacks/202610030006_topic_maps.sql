begin;
drop trigger source_note_topics on public.source_studies;
drop function public.enqueue_source_topics(),public.confirm_topic_placement(uuid,uuid,uuid);
drop function public.request_source_topics(uuid,boolean),public.due_topic_dispatches(integer),public.ack_topic_dispatch(uuid),public.claim_source_topics(uuid),public.finish_source_topics(uuid,uuid,jsonb,text);
drop table public.topic_outbox,public.source_topic_maps;
commit;
