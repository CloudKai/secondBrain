-- Removes derived synthesis/view preferences; preserves source notes and topic maps.
begin;
drop function public.finish_topic_overview(uuid,uuid,jsonb,text);
drop function public.claim_topic_overview(uuid);
drop function public.ack_overview_dispatch(uuid);
drop function public.due_overview_dispatches(integer);
drop function public.set_topic_overview_view(uuid,text,boolean);
drop function public.get_topic_overview(uuid);
drop function public.topic_overview_fingerprint(uuid,uuid);
drop function public.topic_overview_members(uuid,uuid);
drop table public.overview_outbox;
drop table public.topic_overviews;
commit;
