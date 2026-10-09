-- Disable new workspace navigation first; retain the collection read API and
-- compatibility aliases in the deployed binary. Keep identities, membership,
-- triggers and legacy writers so saved/new collection history stays accessible.
begin;
revoke execute on function public.select_learning_collection_lesson(uuid,uuid,integer,bigint) from authenticated;
commit;
-- Forward recovery restores the checked selection grant from migration 019. Do not rerun
-- its additive DDL, or apply older destructive learning downgrades over this data.
