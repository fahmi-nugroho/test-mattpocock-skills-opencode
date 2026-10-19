# 02: Label the inline edit rows

**What to build:** Every inline row editor on the Booking list and the Permintaan list gains the visible label its create-form counterpart already has, wired to its input, plus the same placeholder for the fields that can legitimately be blank. Today each input carries a screen-reader-only name and no visible one, and only the Reference box has a placeholder — so on a populated edit row (every edit row is populated) there is neither text in the box nor a label above it. Placeholders alone would not have fixed this; the label is what makes the row readable.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Every input in the Booking row editor shows a visible label naming it the same way the create form names it (date, status, start, end, client name, client number, event, Headcount, venue, Reference, total, DP, notes).
- [x] Every input in the Permintaan row editor shows a visible label (client name, requested date, requested start, requested end).
- [x] Each label is associated with its input, so clicking the label focuses the box and the accessible name is the visible text rather than a separate screen-reader-only string.
- [x] Optional inputs carry the save-as-create placeholders — the Reference box, the client-number box, the event box, the venue box, and the total box.
- [x] The Style radios and the read-only legacy Style line inside the Booking row editor are unchanged.
- [x] Save, cancel, and every guard behave exactly as before; the rows' layout still reads as one row of fields plus its actions.
- [x] The labelled rows stay usable at 360px without horizontal overflow.

## Comments

- 2026-10-19 — Implemented on `feat/form-layout-polish-spec`.
  - `bookings-manager.tsx`: every `input`/`select` in the inline row editor is now wrapped in a `<label className="block">` with a visible `<span className="text-sm font-medium">` label, and its `aria-label` is deleted. Labels are the create-form labels verbatim — `Tanggal`, `Status`, `Jam mulai`, `Jam selesai`, `Nama klien`, `No. HP / WA klien`, `Jenis acara`, `Jumlah orang`, `Lokasi`, `Referensi (opsional)`, `Total harga (Rp)`, `DP (Rp)`, `Catatan` — so the two surfaces teach the same words (the old edit names `No. HP klien`, `Total harga`, and `DP` were brought up to the create form's wording).
  - Placeholders added from the create form for the ticket's five boxes: `08…` (client number), `Wisuda, lamaran…` (event), `Gedung / alamat` (venue), `Link foto atau deskripsi singkat` (Reference), `Kosongkan bila belum disepakati` (total). The Reference box's old `Referensi (opsional)` placeholder is gone now that the label carries the "(opsional)".
  - `requests-manager.tsx`: the inline name field and the three requested-slot fields gained wrapping labels `Nama klien (opsional)`, `Tanggal (opsional)`, `Jam mulai (opsional)`, `Jam selesai (opsional)` — the create form's wording — and their `aria-label`s were removed.
  - All inputs/selects became `w-full` inside their labels (the two edit grids are `sm:`-gated, so at 360px each is a single column), keeping the rows usable with no horizontal overflow.
  - Unchanged: the Style `fieldset` (radios, ids, names, `onChange`) and the read-only legacy Style line; every handler, guard, validation call, `required`/`min`, and the Save/Cancel buttons.
  - Deliberately kept: no placeholder on the edit `Catatan` box, because the ticket enumerates exactly five optional boxes and lists no sixth; the create form's notes placeholder reads as a creation-time hint. The repeated label chrome was not extracted into a shared `Field` — the repo's inline-Tailwind convention and ticket 01 both keep field chrome inline, and the spec rules out introducing a component/test harness here.
  - Code review (standards + spec axes). Fixed: the Permintaan name input was the only edit input missing `w-full`. Deliberately kept: the above, and the duplicated label strings (repo convention). Verified: `npm run typecheck` clean, `npm run build` clean, full `vitest run` (478 passed). No component tests added, per the spec's Testing Decisions.
