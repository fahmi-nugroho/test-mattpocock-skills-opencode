# 01: Tidy the two admin forms

**What to build:** The Booking section's "Tambah booking" form and the Permintaan section's "Buat link Format Booking" form stop being one flat two-column grid in storage order. Their fields group into labelled fieldsets, each an internal two-column grid that fills its rows, so no row ends in a dangling empty cell — today the DP amount is stranded alone beside the full-width notes field, the status select opens a row by itself, the link form pads its date row with an invisible spacer, and the Style radios occupy a full-width fieldset for two short labels. The radios move inside their group as chips. Every field, label, placeholder, validation rule, and guard is unchanged; only the arrangement changes.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The Booking create form groups its fields into labelled fieldsets — schedule (date, start, end, status), client (name, number), job (event, Headcount, venue, Style, Reference), and money and notes (total, DP, remaining balance, notes).
- [x] The link form groups its fields too — client and send-to, then the optional slot — and no longer pads a row with an invisible spacer cell.
- [x] Each fieldset lays its fields out in two columns at small breakpoints and up, filling its rows; no row is left with an empty cell at any breakpoint.
- [x] The Style radios sit as chips inside the job group instead of a full-width fieldset, and the read-only legacy Style line still appears when a prefill or a stored row carries one.
- [x] The create form's remaining-balance line and total suggestion, the overlap guard, and every validation message behave exactly as before.
- [x] Every field, label, hint, and placeholder is preserved verbatim; the only new text is the fieldset legends.
- [x] Both forms are usable at 360px: single column, no horizontal overflow, no clipped control.

## Comments

- 2026-10-19 — Implemented on `feat/form-layout-polish-spec`.
  - Booking create form now has four fieldsets — `Jadwal` (Tanggal, Jam mulai, Jam selesai, Status), `Klien` (Nama klien, No. HP / WA klien), `Layanan dan detail acara` (Layanan, Jenis acara, Jumlah orang, Lokasi, Gaya rambut, Referensi), `Pembayaran dan catatan` (Total harga, DP, Sisa pembayaran, Catatan) — each an internal `grid gap-3 sm:grid-cols-2`.
  - `Layanan` is not named in the ticket's four groups but is a required field, so it was placed at the head of the job group, whose legend therefore reads `Layanan dan detail acara`. Without it that group has five fields and one row would dangle; with it the group fills three clean rows. This is the one deliberate deviation and it is called out here rather than silently re-scoping.
  - The Style radios lost their own full-width fieldset: they are a nested `fieldset` cell inside the job group, styled as `rounded-full` chips (`px-3.5 py-1.5`), with the read-only legacy line still beneath them. Radio ids/names/values and the `onChange` that clears the legacy prefill are unchanged.
  - The remaining-balance line moved inside the money fieldset, spanning both columns directly under Total/DP; `createRemaining`, `suggestTotal`, `totalTouched`, and `formatIDR` are untouched.
  - Link form now has two fieldsets — `Klien dan pengiriman` (Nama klien, No. WhatsApp) and `Jadwal opsional` (Tanggal spanning both columns, then Jam mulai / Jam selesai). The invisible `<span className="hidden sm:block" />` spacer is deleted; the date spans instead, so no row is padded.
  - Fieldsets use `min-w-0` so a long `select`/`input` cannot blow out the grid at 360px; the grids are single-column below `sm`, and the outer form keeps its `p-4` with the fieldsets at `p-3 sm:p-4`.
  - Every label, placeholder, hint, `required`, `min`, validation message, and the `onCreate` handler are byte-for-byte unchanged apart from re-indentation.
  - Deliberately kept: the edit-row Style fieldset (ticket 02's surface) and the "Tanggal dan jam bersifat opsional…" hint, which still sits below the slot group as before.
  - Code review (standards + spec axes). Fixed: Style options made into chips (they had only moved, not restyled) and two legend names tightened (`Klien dan pengiriman`, `Jadwal opsional`). Deliberately kept: the `Layanan` placement above (the spec's five-field group cannot fill a two-column grid without a dangling cell), and the repeated fieldset chrome, which matches the repo's inline-Tailwind convention.
  - Verified: `npm run typecheck` clean, `npm run build` clean, full `vitest run` (478 passed). No component tests added, per the spec's Testing Decisions.
