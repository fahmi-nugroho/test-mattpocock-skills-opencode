# Spec: Calendar Popup Inquiry with Booked Times

Status: ready-for-agent

## Problem Statement

As a client checking the makeup calendar, I tap a date and either miss the detail shown below the calendar or see an all-day-open label even though parts of the day are already taken, so I cannot tell which times are already booked by other clients and I have to ask blindly over chat.

## Solution

Tapping a calendar date opens a popup over the calendar showing that day's booked and blocked times (times plus kind only, no personal data), with a time picker so the client can propose a non-overlapping time that is prefilled into the chat message. Operating hours are removed from the product entirely since they are not used day-to-day and were hiding real bookings made outside the stored window.

## User Stories

1. As a client on mobile, I want to tap a future or today calendar day, so that a popup opens over the calendar with that day's detail.
2. As a client, I want the popup to list booked time ranges with start-end times, so that I know when the artist is already taken.
3. As a client, I want the popup to list blocked time ranges with start-end times, so that I know when the artist is closed for slices of the day.
4. As a client, I want booked and blocked ranges visually distinguished by label and colour, so that I do not confuse the two.
5. As a client, I want an all-day closure to show as a single closed-all-day row, so that I do not misread it as bookable slices.
6. As a client, I want a day with no occupied ranges to show as available-all-day, so that I know the whole day is open.
7. As a client, I want to never see other clients' names, phones, notes, service names, or block reasons, so that their privacy is protected.
8. As a client, I want only confirmed work to occupy the day, so that tentative holds do not falsely show as taken.
9. As a client, I want past days to stay inert and muted with no popup, so that I do not try to ask about the past.
10. As a client, I want the inline detail panel below the calendar gone, so that there is exactly one place to read day detail: the popup.
11. As a client, I want the popup to trap focus and announce politely to assistive tech, so that screen-reader and keyboard users get the same info.
12. As a client, I want to close the popup via close button, backdrop tap, or Escape, so that I can return to browsing dates.
13. As a client, I want focus to return to the date I tapped after closing, so that I do not lose my place.
14. As a client, I want a loading indicator inside the popup while day detail loads, so that I know the tap worked.
15. As a client, I want an error with retry inside the popup when day detail fails, so that a flaky connection does not strand me.
16. As a client, I want the popup header to show the full date plus the day status label, so that context is preserved.
17. As a client, I want to enter a start time and end time I wish to ask about, so that I can propose a concrete slot.
18. As a client, I want the time picker to start empty with a hint to choose a time, so that I am not anchored to a preselected slot.
19. As a client, I want an immediate inline error when end is not after start, so that I can fix it before asking.
20. As a client, I want an immediate inline error when my chosen range overlaps a booked or blocked range, so that I do not ask for an impossible time.
21. As a client, I want the date chat action disabled until my chosen time is valid and non-overlapping, so that I cannot send a conflicting request by accident.
22. As a client, I want the date chat action to prefill date plus my chosen start-end time, so that I do not retype it and the admin sees exactly what I want.
23. As a client, I want a secondary chat action without a time, so that I can still ask generally when I am unsure.
24. As a client, I want no time picker and no date chat action on full or closed-all-day popups, so that I am not invited to ask for impossible times.
25. As a client, I want the general chat button to remain when no popup is open, so that I can still ask without picking a date.
26. As a client, I want bookings made at any hour of the day to appear in the popup, so that early or late work is never silently hidden.
27. As an admin, I want my confirmed bookings at any hour to appear as booked ranges, so that the public popup stays truthful without me watching a hours setting.
28. As an admin, I want my timed blocks at any hour to appear as blocked ranges, so that leave slices are honoured.
29. As an admin, I want my all-day blocks and manual full-toggle days to collapse to closed-all-day, so that I do not need fake time ranges to close a day.
30. As an admin, I want no operating-hours inputs in settings, so that I am never confused by values that no longer affect the public calendar.
31. As an admin, I want the final booking time to remain my decision in the admin panel, so that client proposals stay proposals until I confirm them.

## Implementation Decisions

- Modules built or modified: public month calendar UI (selectable days plus popup dialog replacing the inline panel), public schedule data-access plus pure merge and sort helpers, chat link builder (new date-plus-time variant), public schedule functions for month and day, admin settings form and validation, shared day-status derivation.
- Interaction: only today and future days open the popup; past days stay inert and muted; month change closes any open popup and clears selection; popup state machine is loading, error with retry, and content; exactly one popup at a time.
- Privacy contract (extends the existing month-RPC approach): public functions return start and end times plus kind and closure flags only; they never return client names, phones, notes, service names, block reasons, or operating-hours values; the client validator strips extra keys and fails closed on malformed shapes.
- Occupancy rule unchanged except unclamping: only confirmed bookings plus timed blocks occupy; pending and cancelled never occupy and never appear; all-day closure outranks times; occupied intervals are returned raw in chronological order with no clamping to any window.
- Display merge: adjacent or overlapping same-kind occupied intervals merge for display; different-kind intervals stay separate in chronological order; the merge is defensive since admin guards already prevent overlap.
- Fully-booked becomes unreachable: with no operating window to cover, coverage derivation is removed; manual full-toggle dates and all-day blocks resolve to the closed status only; the full legend entry and status metadata remain as dead code for now and may be revived later.
- Operating-hours removal is full removal: settings open and close columns are dropped via forward migration with a restore note; derivation signatures lose their window arguments; both public schedule functions stop reading hours; admin UI inputs are deleted; seed data no longer carries hours.
- Time picker: two time inputs accepting any same-day range where start is before end; validation is the single shared half-open overlap rule already used by admin guards (touching ranges do not overlap); no duration, step, or window restriction in v1; admin remains the source of truth at confirmation time.
- Chat: existing general and date-only chat messages stay untouched; new date-plus-time message appends the chosen start-end range to the date message in Indonesian copy; links reuse the existing wa.me builder with digit normalisation and encoding.
- Copy and locale: Indonesian labels for available, full, closed, booked, blocked, closed-all-day, available-all-day, loading, retry, picker hint, overlap error, and order error, consistent with the current calendar voice.
- Dialog chrome: custom dialog element with modal semantics styled to the existing panel theme; Escape, backdrop, and explicit close all dismiss; background scrolling locks while open; focus returns to the invoking date on close.
- Single-action rule preserved: the popup's date chat actions carry the inquiry while open; the general chat starter shows only when no popup is open.
- Architectural note: this removes the operating-window seam from the domain model; the change is hard to reverse without a restore migration and is therefore recorded as an ADR on build.

## Testing Decisions

- What makes a good test: given calendar inputs assert externally visible behaviour (public detail shape, overlap verdicts, chat URLs, status derivation) without asserting component internals, SQL internals, or live database state; given malformed payloads assert fail-closed throws; given leak-attempt payloads with personal data assert stripping.
- Modules to test: the extended schedule mapping and merge helpers, the overlap validator applied to picker ranges, the new date-plus-time chat message builder, and the window-free status derivation.
- Prior art: existing Vitest suite for day-status derivation, overlap checks, chat link building, and schedule-row mapping with mocked RPC payloads. New tests follow the same style in the same test directory: pure inputs in, asserted shapes out, privacy-leak rejection cases included.
- Manual pass: open and close the popup by all three dismiss paths, picker valid and overlapping and inverted ranges, chat prefill content, closed and empty days, month change with popup open, keyboard and small-screen check, plus typecheck and full suite green.
- Agreed seam: single extended seam covering pure schedule mapping plus merge helpers plus overlap plus chat builders with mocked data access. A separate UI-driven or live-database seam was considered and rejected to keep the seam count at one.

## Out of Scope

- Showing pending or cancelled bookings, even as tentative.
- Showing client names, phones, notes, service names, or block reasons.
- Booking creation, payment, chat automation, accounts, multi-admin, analytics, or realtime refresh of open tabs.
- Duration-aware slot suggestions, service-linked durations, or step restrictions on the picker.
- Reviving an auto-derived full status or reintroducing operating hours.
- Changing admin overlap guards beyond dropping the window clamp, or changing booking lifecycle pending to confirmed or cancelled.

## Further Notes

- Domain vocabulary in use: Booked slot is a confirmed booking time range; Blocked slot is a timed block range; Occupied is booked plus blocked together; All-day closure is a manual full-toggle date or an all-day block shown as one closed row; Day Status is closed, full (currently unreachable), or available.
- Stack remains single app-router web app plus hosted database plus utility CSS, Indonesian locale, mobile-first.
- Suggested build order: schedule functions plus grants, then data-access validator plus pure helpers plus unit tests, then calendar popup plus picker plus chat links, then admin settings removal, then typecheck plus full suite plus responsive and keyboard QA.
