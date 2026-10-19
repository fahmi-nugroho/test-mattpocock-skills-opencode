# 01: Search the Permintaan list

**What to build:** The Permintaan list gains the same client-side search box every other admin list already has. Typing into it narrows the list to the requests matching what the admin remembers about a client; an empty query shows everything and a query that matches nothing says so. There is nothing new to learn — the box behaves exactly like the ones on the other lists, reusing their substring convention unchanged.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A search box sits above the list, labelled like the ones on the other admin lists.
- [x] Typing narrows the list to requests matching on any of: client name, client number, event, venue, Style, Reference, notes, requested date, or the state label.
- [x] An empty or whitespace-only query shows the whole list.
- [x] A query that matches nothing shows a "no results" line naming the query; a genuinely empty list still shows its own empty-state copy instead.
- [x] Search reuses the existing substring helper and convention unchanged — no new matching rules.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - Added a `type="search"` box above the list in `RequestsManager`, labelled `Cari permintaan…` / `aria-label="Cari permintaan"`, matching the five sibling admin lists.
  - The list filters through the same pure `filterByQuery` helper (no new matching rules), with a picker over `client_name`, `client_phone`, `event_type`, `venue`, `hairdo` (Style), `reference`, `notes`, `date`, and the derived state label. An empty/whitespace query returns the whole list; `items.length > 0 && visibleRows.length === 0` renders `Tidak ada hasil untuk "<query>".`, while a genuinely empty list keeps its own `Belum ada permintaan…` copy.
  - The derived state is clock-dependent, so it is computed once per list load into a `rows` memo; the search picker and the row badge read the same value, so the label the admin sees and the label the box matches can never disagree.
  - No new tests, per the spec's Testing Decisions (the request list has no component tests and does not gain any); covered by manual QA like the other lists.
  - Code review (standards + spec axes): the spec axis confirmed all five acceptance criteria met and no scope creep; both axes flagged the duplicated clock-derived state label, fixed as above.
  - Verified: `npm run typecheck` clean and full `vitest run` (445 passed).
