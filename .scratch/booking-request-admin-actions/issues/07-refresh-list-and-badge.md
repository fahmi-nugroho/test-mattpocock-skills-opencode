# 07: Refresh the list and the badge

**What to build:** A refresh button on the section lets the admin pull in a request that arrived while the page was open, without reloading everything. The list's load is hoisted so the button can call it, and pending is kept separate from the initial load so refreshing never blanks the list behind a loading message. The tab badge updates from the same load, so the count never disagrees with the list, and the existing cross-panel refetch signal keeps working untouched. No realtime and no background polling are added.

**Blocked by:** 06 — Re-send a live link.

**Status:** resolved

- [x] A refresh button on the section reloads the list on demand.
- [x] Refreshing never blanks the list behind a loading message; the pending state is separate from the initial load.
- [x] A request that arrived while the page was open appears after refresh, with no page reload.
- [x] The tab badge count updates from the same load, so the count never disagrees with the list.
- [x] The existing cross-panel refetch signal keeps working unchanged; no realtime and no background polling are introduced.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - UI in `RequestsManager`: a `Muat ulang` button in the "Daftar permintaan" header (`ml-auto`, `disabled`/`Memuat…` while in flight), beside the in-panel "perlu ditindak" badge.
  - The list's load is hoisted out of its effect into a `useCallback` (`load`), so the mount, the button, and the `SCHEDULE_CHANGED_EVENT` refetch all run one path. `onRefresh` guards on `refreshing` (mirroring `onCreate`'s `if (creating) return`), flips `refreshing`, and calls `load`.
  - Pending is separated from the initial load per the spec: `loading` is the one-time first load and never turns back on, so the `if (loading) return "Memuat permintaan…"` branch cannot blank a populated list; a reload flips `refreshing` only. The old per-effect `cancelled` closure was replaced by a `mountedRef` (a consequence of hoisting, not extra behaviour) so a load that finishes after unmount still touches no state.
  - The badge cannot disagree with the list: `load` computes both `setAttentionCount(count)` and `onAttentionCountChange?.(count)` from the same `rows`, in the same pass that fills `items`; the parent tab badge (`page.tsx` `onAttentionCountChange={setRequestCount}`) is therefore updated by the same load. The `SCHEDULE_CHANGED_EVENT` listener is preserved and now calls that same `load`; no realtime and no polling are introduced.
  - Deliberate: refresh does not reset the chosen chip or the search query. A new request is fetched into the list on every refresh (AC3, default `all` view), and the chip/query are the admin's view state — resetting them would be a view change the ticket did not ask for and would fight the "Deliberately unchanged" scope, unlike `onReissue`'s one-time `setFilter("all")` for a row it just prepended.
  - Code review (standards + spec axes). Fixed: the loading-vs-refreshing rationale was triplicated (component JSDoc + state comment + `load` JSDoc) — the state comment was trimmed to one line. Deliberately kept: the `filterBookingRequests(rows, "needs_action", …)` shape that `load` and `onDelete` share (pre-existing, and extracting it would need a shared hook or a module helper beyond this ticket's scope); the badge clock being a fresh `new Date()` while the rows use the memoised `now` (pre-existing, unchanged here, and "state derivation" is explicitly out of scope); and no sequence guard between concurrent loads (both are full-list reads, so the last-writer-wins window is negligible). No scope creep beyond the button and the load's extraction.
  - Tests: none, per the spec's Testing Decisions (the request list has no component tests and gains none; the button is manual QA like every other screen). Verified: `npm run typecheck` clean and full `vitest run` (478 passed).
