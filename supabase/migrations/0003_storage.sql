-- 0003_storage.sql — ticket 02: public image buckets.
--
-- Buckets `portfolio/` and `prices/` hold portfolio images and service
-- cover images. Public-read (landing uses plain public URLs + next/image),
-- write restricted to the authenticated admin role.

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true),
       ('prices', 'prices', true)
on conflict (id) do update set public = true;

-- Public + admin read for both buckets (admin reads via the authenticated
-- role, which needs its own SELECT grant; anon-only would lock admin out).
create policy storage_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('portfolio', 'prices'));

-- Admin write (insert / update / delete) for both buckets.
create policy storage_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('portfolio', 'prices'));

create policy storage_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('portfolio', 'prices'))
  with check (bucket_id in ('portfolio', 'prices'));

create policy storage_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('portfolio', 'prices'));
