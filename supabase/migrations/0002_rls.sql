-- 0002_rls.sql — ticket 02: row-level security.
--
-- Public (anon) reads: active services + visible portfolio + day-status RPC
-- only. Raw bookings / blocks / settings rows (client PII, notes, reasons)
-- are NEVER exposed to anon — there are no anon SELECT policies on those
-- tables, and the month RPC (0004) returns date+status only.
-- Authenticated role (single admin, email+password, no public signup)
-- gets full CRUD on all five tables.

alter table services enable row level security;
alter table portfolio_items enable row level security;
alter table bookings enable row level security;
alter table blocks enable row level security;
alter table settings enable row level security;

-- Public reads: active services only.
create policy services_public_read on services
  for select to anon
  using (active = true);

-- Public reads: visible portfolio items only.
create policy portfolio_items_public_read on portfolio_items
  for select to anon
  using (visible = true);

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
create policy services_admin_all on services
  for all to authenticated
  using (true) with check (true);

create policy portfolio_items_admin_all on portfolio_items
  for all to authenticated
  using (true) with check (true);

create policy bookings_admin_all on bookings
  for all to authenticated
  using (true) with check (true);

create policy blocks_admin_all on blocks
  for all to authenticated
  using (true) with check (true);

create policy settings_admin_all on settings
  for all to authenticated
  using (true) with check (true);
