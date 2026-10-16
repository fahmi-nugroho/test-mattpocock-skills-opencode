-- 0013_profile_testimoni_schema.sql — ticket 01: profil & testimoni schema foundation.
--
-- WHAT: extends the single-row settings table with headline, subcopy, and
-- portrait_url columns; adds testimonials and profile_stats collections
-- (each with sort order + visible flag); exposes visible-only public reads
-- and authenticated-admin full CRUD via RLS; adds a public `profile`
-- bucket for portrait uploads.
--
-- DEFAULTS RATIONALE: headline/subcopy defaults mirror the current
-- hardcoded hero copy so a fresh database renders identically to the
-- existing landing before the admin edits anything. portrait_url stays
-- nullable with no default and must be an HTTPS URL when set (spec #44) —
-- an empty portrait falls back to the first
-- visible portfolio cover (see getHeroPortraitUrl).
--
-- FALLBACK BEHAVIOR: the landing keeps its hardcoded HERO_STATS and
-- TESTIMONIALS constants plus the getHeroPortraitUrl fallback and uses
-- them whenever the new tables return empty lists, so the landing never
-- renders blank on an empty database. No backfill: the admin fills the
-- tables manually after release.
--
-- STORAGE REUSE RATIONALE: the existing public buckets (portfolio, prices
-- per 0003_storage.sql) are public-read with authenticated-admin write.
-- Portraits follow the same pattern, so instead of a one-off policy shape
-- we add a `profile` bucket and extend the same four storage.objects
-- policies to cover ('portfolio', 'prices', 'profile'). Policy expressions
-- cannot be altered in place, so the old policies are dropped and
-- re-created under identical names — existing schema assertions on those
-- policy names keep passing. Settings stays anon-denied (no new anon
-- policy on settings): the admin already has settings_admin_all from
-- 0002, and the id = 1 single-row constraint from 0001 is untouched.

-- Profil columns on the single-row settings table (id = 1 constraint intact).
alter table settings
  add column headline text not null default 'Tampil memukau di hari spesialmu'
    check (char_length(headline) <= 120);

alter table settings
  add column subcopy text not null default 'Lihat portfolio, pilih layanan, lalu diskusikan tanggal dan waktu langsung via WhatsApp — tanpa daftar akun.'
    check (char_length(subcopy) <= 300);

alter table settings
  add column portrait_url text
    check (portrait_url is null or (char_length(portrait_url) <= 2048 and portrait_url like 'https://%'));

-- Testimonials collection (public: only visible rows readable).
create table testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null
    check (char_length(quote) >= 1 and char_length(quote) <= 300),
  client_name text not null
    check (char_length(client_name) >= 1),
  sort integer not null default 0
    check (sort >= 0),
  visible boolean not null default true
);

-- Profile stats collection (public: only visible rows readable).
create table profile_stats (
  id uuid primary key default gen_random_uuid(),
  value text not null
    check (char_length(value) >= 1 and char_length(value) <= 40),
  label text not null
    check (char_length(label) >= 1 and char_length(label) <= 40),
  sort integer not null default 0
    check (sort >= 0),
  visible boolean not null default true
);

-- Lookup indexes for the visible-ordered public lists.
create index testimonials_visible_sort_idx on testimonials (visible, sort);
create index profile_stats_visible_sort_idx on profile_stats (visible, sort);

alter table testimonials enable row level security;
alter table profile_stats enable row level security;

-- Public reads: visible testimonials only.
create policy testimonials_public_read on testimonials
  for select to anon
  using (visible = true);

-- Public reads: visible profile stats only.
create policy profile_stats_public_read on profile_stats
  for select to anon
  using (visible = true);

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
create policy testimonials_admin_all on testimonials
  for all to authenticated
  using (true) with check (true);

create policy profile_stats_admin_all on profile_stats
  for all to authenticated
  using (true) with check (true);

-- Portrait bucket: public-read, authenticated-write, like portfolio/prices.
insert into storage.buckets (id, name, public)
values ('profile', 'profile', true)
on conflict (id) do update set public = true;

-- Re-create the 0003 storage policies with the 3-bucket list (policy
-- expressions cannot be altered; names stay identical).
drop policy if exists storage_public_read on storage.objects;
drop policy if exists storage_admin_insert on storage.objects;
drop policy if exists storage_admin_update on storage.objects;
drop policy if exists storage_admin_delete on storage.objects;

create policy storage_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('portfolio', 'prices', 'profile'));

create policy storage_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('portfolio', 'prices', 'profile'));

create policy storage_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('portfolio', 'prices', 'profile'))
  with check (bucket_id in ('portfolio', 'prices', 'profile'));

create policy storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('portfolio', 'prices', 'profile'));
