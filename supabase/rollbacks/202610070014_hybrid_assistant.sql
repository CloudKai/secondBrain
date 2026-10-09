-- Disable ENABLE_HYBRID_RETRIEVAL and restart API processes before rollback.
-- Retains captures, notes and retrieval indexes; restores the existing query path.
begin;
drop function if exists public.get_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb);
drop function if exists public.validate_hybrid_assistant_context(uuid,integer,uuid,boolean,jsonb);
drop function if exists public.get_assistant_search_inventory(uuid,integer,uuid,boolean);
commit;
