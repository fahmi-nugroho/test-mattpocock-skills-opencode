# Spec: Client Calendar Day Detail

Status: ready-for-agent

## Problem Statement

As a client checking the makeup calendar, I only see a whole day coloured as available, full, or closed, so I cannot tell which time ranges on that day are already booked or blocked and I have to ask blindly over chat.

## Solution

Keep the existing month grid exactly as-is, but let me tap a day to see that day's detail below the calendar: a list of occupied time ranges labelled as booked or blocked, and a chat button that already includes that date. Free gaps are no longer shown — clients propose a time via WhatsApp. All-day closures show as a single closed-all-day row. No personal data is ever shown.

## User Stories

1. As a client on mobile, I want to tap a future/today calendar day, so that I see what is happening on that specific day.
2. As a client, I want to see booked time ranges for the selected day with start-end times, so that I know when the artist is already taken.
3. As a client, I want to see blocked time ranges for the selected day with start-end times, so that I know when the artist is on leave or private time.
4. As a client, I want booked and blocked ranges visually distinguished by label and colour, so that I do not confuse the two.
5. (Superseded — free gaps hidden from UI) As a client, I see only booked/blocked ranges plus a hint to propose my own time via WhatsApp, so that I am not anchored to server-derived gaps.
6. As a client, I want an all-day closure to show as a single Sehari penuh — Tutup row, so that I do not misread it as bookable slices.
7. As a client, I want a day with no occupied ranges to show as Seharian tersedia, so that I know the whole day is open.
8. As a client, I want past days to stay inert and muted with no detail, so that I do not try to book the past.
9. As a client, I want tapping the selected day again to deselect it, so that I can dismiss the detail.
10. As a client, I want changing month to clear the selection, so that stale day detail does not linger.
11. As a client, I want a loading indicator while day detail loads, so that I know the tap worked.
12. As a client, I want an error with retry when day detail fails to load, so that a flaky connection does not strand me.
13. As a client, I want the detail header to show the full date plus the day status label, so that context is preserved.
14. As a client, I want the detail panel announced politely to assistive tech, so that screen-reader users get the same info.
15. As a client, I want keyboard-focusable days with pressed state, so that I can operate the calendar without a mouse.
16. As a client, I want a per-date chat button that prefills only the date in the message, so that I do not retype it but time is still negotiated in chat.
17. As a client, I want the existing general chat button to remain, so that I can still ask without picking a date.
18. As a client, I want to never see client names, phones, notes, or block reasons, so that other people's privacy is protected.
19. As a client, I want only confirmed work to occupy the day, so that tentative holds do not falsely show as full.
20. As an admin, I want my confirmed bookings to appear as booked ranges, so that the public detail stays truthful.
21. As an admin, I want my timed blocks to appear as blocked ranges, so that leave slices are honoured.
22. As an admin, I want my all-day blocks and manual full-toggle days to collapse to closed-all-day, so that I do not need fake time ranges to close a day.

## Implementation Decisions

- Modules touched: public month calendar UI (add selectable days + day-detail panel), public schedule data-access (new per-day fetch + validation), shared availability logic (merge + sort occupied), chat link builder (date-prefill variant), database public schedule function.
- New public schedule function takes a single calendar date and returns the derived day status, an all-day-closed flag, a sorted occupied list with kind booked or blocked, and a derived free list. It reads operating hours internally from settings to clamp and gap-compute but never returns operating hours to the browser (per Q7 removal). The free list is still computed/validated server-side but intentionally not rendered in UI — clients propose a time via WhatsApp.
- Privacy contract (extends the existing month-RPC ADR): the new function selects only start/end times plus closure flags; it never selects client names, phones, notes, or block reasons, and the client validator strips any extra keys and fails closed.
- Occupancy rule unchanged: only confirmed bookings plus timed blocks occupy; pending and cancelled never occupy and never appear. All-day closure outranks times.
- Occupied intervals are returned sorted; adjacent same-kind intervals merge for display; overlapping different-kind display keeps both labels in chronological order (admin guards already prevent overlap, merge is defensive).
- Interaction: only today/future days are selectable buttons with selected ring; past days inert muted; selection toggles; month change clears selection; empty-available shows Seharian tersedia; detail state machine is idle / loading / error+retry / content.
- Chat: keep the existing general chat link untouched; add a per-date link that prefills the selected calendar date only, reusing the existing wa.me link builder with ID copy.
- Copy/locale: Indonesian labels Tersedia / Penuh / Tutup, Terisi for booked ranges, Tutup for blocked ranges, Sehari penuh — Tutup, Seharian tersedia, Memuat detail, failure retry copy consistent with month grid. Occupied days show hint "Di luar jam di atas masih bisa ditanyakan — tulis jam yang kamu mau via WhatsApp." instead of the removed "Sisa tersedia" free-gap list.
- No operating-hours header in UI for now; no hours values reach the browser.
- No change to the existing month availability contract; month grid behaviour, colours, legend, and empty states stay as-is.

Proposed seam (highest possible, one seam extended): extend the existing pure availability + RPC-mapper seam to cover day-schedule mapping, occupied merge/sort, and free-list passthrough validation. No component-internals testing, no live DB in unit tests.

## Testing Decisions

- What makes a good test: given a date plus confirmed bookings / timed blocks / closures, assert the public detail shape (status, occupied with kinds sorted/merged, free gaps, all-day flag) and assert no extra keys leak; given malformed rows assert fail-closed throw; given link inputs assert wa.me URL with date prefill. Test external behaviour only, never component internals or SQL internals.
- Modules to test: the extended schedule data-access validator plus the pure merge/sort helpers; the new database function covered by contract test via mocked RPC payloads, not a live database.
- Prior art: existing Vitest suite for day-status derivation, overlap check, chat link building, and month-row mapping. New tests follow the same style in the same test directory: pure inputs in, asserted shapes out, PII-leak rejection cases included.

Agreed seam with user (proposed, pending confirm on build): Single extended seam — pure schedule mapping + merge helpers, DB mocked. Alternative of separate UI-driven tests rejected to keep seam count at one.

## Out of Scope

- Showing pending or cancelled bookings, even as tentative.
- Showing client names, phones, notes, service names, or block reasons.
- Exposing or displaying operating hours values to the browser.
- On-site date/time picker, booking creation, payment, chat automation, accounts, multi-admin, analytics.
- Realtime refresh of already-open tabs; month data already refreshes on next load.
- Changing admin overlap guards, full-toggle semantics, or month-RPC shape.

## Further Notes

- Glossary (proposed, to be captured lazily on build): Booked slot = confirmed booking time range; Blocked slot = timed block range; All-day closure = manual full-toggle date or all-day block (single closed row); Free slot = server-derived gap (no hours exposed); Day Status = blocked / fully_booked / available (unchanged).
- Stack remains single Next.js App Router + Supabase + Tailwind, ID locale, mobile-first.
- Build order: database function + grants, then data-access validator + pure helpers + unit tests, then calendar UI detail panel + per-date chat link, then typecheck + full test suite + responsive/keyboard QA.
