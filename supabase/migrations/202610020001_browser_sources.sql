-- Browser sources are independent of the native fixed-folder MVP.
begin;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_url text not null check (original_url ~ '^https?://'),
  canonical_url text not null check (canonical_url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 200),
  captured_text text not null check (char_length(captured_text) between 120 and 30000),
  captured_at timestamptz not null default now(),
  capture_origin text not null check (capture_origin in ('direct', 'reader', 'pasted')),
  coverage text not null check (coverage in ('complete', 'partial', 'unknown')),
  coverage_detail text not null check (char_length(coverage_detail) between 1 and 500),
  study_status text not null default 'pending' check (study_status = 'pending'),
  unique (user_id, canonical_url)
);

create index sources_owner_capture on public.sources (user_id, captured_at desc, id desc);
alter table public.sources enable row level security;
revoke all on table public.sources from anon, authenticated;
grant select, insert, delete on table public.sources to authenticated;

create policy sources_read_own on public.sources
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sources_insert_own on public.sources
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sources_delete_own on public.sources
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
