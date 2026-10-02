-- Reverses the browser-source migration and removes its captured records.
begin;
drop table public.sources;
commit;
