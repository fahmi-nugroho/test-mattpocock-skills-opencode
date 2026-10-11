-- 0006_portfolio_category_cap.sql — ticket 06 follow-up: server-side
-- enforcement of the ≤6 distinct portfolio categories cap.
--
-- The admin UI checks the cap client-side, but that reads only the loaded
-- list: concurrent writers or direct API writes could bypass it and break
-- the landing's filter tabs (MAX_CATEGORIES in src/lib/portfolio.ts).
-- A plain CHECK can't count distinct values, so an AFTER trigger raises
-- when an insert/update would leave more than six distinct categories.
-- Deletes can only shrink the set, so no trigger is needed there.

create or replace function enforce_portfolio_category_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  distinct_count integer;
begin
  select count(*) into distinct_count
  from (select distinct category from portfolio_items) as cats;
  if distinct_count > 6 then
    raise exception 'Maksimal 6 kategori portfolio';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_category_cap on portfolio_items;
create trigger portfolio_category_cap
  after insert or update of category on portfolio_items
  for each row execute function enforce_portfolio_category_cap();
