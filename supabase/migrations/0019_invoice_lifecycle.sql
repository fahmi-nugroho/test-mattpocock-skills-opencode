-- 0019_invoice_lifecycle.sql — invoice-and-booking-filter ticket 03.
--
-- WHAT: freezes an Invoice once it is marked sent. Only `sent_at` itself may
-- change while the mark is present, which is how the admin explicitly clears
-- it; every snapshot, date and number field must still match the row the
-- client received. A direct delete of a sent Invoice is refused until it is
-- unmarked, while the `on delete cascade` from its Booking still removes it:
-- deleting a Booking must not fail because one of its Invoices was sent.
--
-- WHY: `sent_at` is the only stored lifecycle state. A sent Invoice is what
-- the client already holds, so it is history: correcting it means issuing the
-- next number, never rewriting or removing the old row. The screen hides the
-- date editor and the delete action for a sent Invoice; this trigger is the
-- invariant that holds even if a write bypasses the screen.
--
-- NUMBER REUSE: `create_invoice` (0018) allocates `max(seq) + 1` for the year,
-- so deleting the newest unsent Invoice frees its number for the next issue
-- instead of leaving a skip. The delete guard here is what keeps a direct
-- delete from recycling the number of a document a client already received.

create or replace function guard_invoice_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.sent_at is not null then
    if tg_op = 'DELETE' then
      -- A direct delete runs this trigger at depth 1. The Booking's
      -- `on delete cascade` reaches it through the foreign-key trigger, at
      -- depth 2, and that path must be allowed to complete.
      if pg_trigger_depth() <= 1 then
        raise exception 'Invoice yang sudah dikirim tidak dapat dihapus.';
      end if;
    elsif (to_jsonb(new) - 'sent_at') is distinct from (to_jsonb(old) - 'sent_at') then
      -- The mark is the only thing that may move. Clearing it (sent_at ->
      -- null) is allowed; so is a no-op write. Everything else is frozen.
      raise exception 'Invoice yang sudah dikirim tidak dapat diubah.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_guard_lifecycle on invoices;
create trigger invoices_guard_lifecycle
  before update or delete on invoices
  for each row
  execute function guard_invoice_lifecycle();
