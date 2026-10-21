# ADR-0001: Remove the operating-hours window and coverage derivation

Status: accepted

Date: 2026-10-12

## Context

The public calendar derived a per-day status (`available` | `fully_booked` |
`blocked`) by checking whether confirmed bookings plus timed blocks jointly
covered the whole `[open_hour, close_hour)` operating window stored on the
`settings` row. The window leaked into three places: the `settings` table
(`open_hour` / `close_hour` columns), the `get_month_availability` and
`get_day_schedule` RPCs (window reads, `hhmm_to_min` conversion, clamped
coverage walk), and the shared `computeDayStatus` derivation plus the admin
settings form (hours inputs and validation).

Two problems made the window a liability rather than a feature:

1. **It hid real work.** Bookings made outside the stored window (early
   morning, late night) were clamped away and never shown, so the public
   calendar silently lied about occupied times.
2. **It was unused day-to-day.** The admin never changed the hours, so the
   inputs were confusion without value, and the `fully_booked` status they
   produced was the only consumer of the coverage machinery.

## Decision

Remove the operating window end to end:

- Drop `settings.open_hour` / `settings.close_hour` via forward migration
  `0012_settings_drop_hours.sql` (carries a header restore note).
- Redefine `get_month_availability` window-free in
  `0011_month_window_free.sql`: it reads ONLY `full_dates`, resolves
  `blocked` for full-toggle dates or all-day blocks and `available`
  otherwise. Calendar days are walked with plain date arithmetic so the
  migration contains no `generate_series` / `greatest` / `least` /
  `hhmm_to_min` at all and the contract stays greppable.
- `computeDayStatus(date, bookings, blocks, fullDates)` loses its window
  arguments and the `coversWindow` helper; timed occupancy no longer
  affects the status (ranges are shown raw in the popup instead).
- The admin settings form, validation, persistence, and `Settings` type
  carry `wa_number` only.
- `fully_booked` becomes UNREACHABLE but stays in the `DayStatus` union,
  the legend entries, and the status metadata as dead code (each marked
  with a comment pointing back here).

Migration ordering is deliberate: the RPC redefine (0011) runs BEFORE
the column drop (0012), so no live function ever references a missing
column. Dropping first would leave the old window-reading RPC broken
until the redefine lands.

## Update

Status: accepted; the settings clause is superseded in part.

The invoice feature (migration `0018_invoices_schema.sql`; ticket
`.scratch/invoice-and-booking-filter/issues/07-payment-settings-fields.md`)
added `bank_name`, `account_name`, `account_number` and `instagram_handle` to
`settings` and to the admin settings form. The decision clause "carry
`wa_number` only" above therefore no longer holds. No operating-hours window
or coverage derivation returned.

## Consequences

- Days with any timed occupancy now read `available` with the occupied
  ranges listed in the popup; clients propose any same-day time and the
  admin stays the source of truth at confirmation.
- The change is hard to reverse without a restore migration, which is
  why this ADR exists.

## What would revive the full status

1. Forward migration re-adding the columns per the 0012 restore note
   (`open_hour` / `close_hour` with the `HH:MM` checks and the
   `open_hour < close_hour` check).
2. Coverage derivation restored in `get_month_availability` (the
   covered-minutes walk lives on in `0004_seed_rpc.sql` history).
3. Window arguments reintroduced on `computeDayStatus` plus the
   `coversWindow` helper, admin hours inputs, validation, and
   persistence.
4. The dead `fully_booked` legend/metadata entries become live again
   with no shape change — the `(date, status)` RPC contract and the
   `DayStatus` union never dropped the value.
