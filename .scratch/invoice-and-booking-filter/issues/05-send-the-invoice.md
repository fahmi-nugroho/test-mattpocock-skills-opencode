# 05: Send the Invoice from the phone

**What to build:** "Bagikan" sends the previewed PNG through the phone's own share sheet when the browser supports sharing files. When it does not — a desktop browser, mainly — the same action downloads the PNG so it can be attached by hand, and the dialog still offers opening the WhatsApp conversation with a prefilled invoice message naming the client and the invoice number. Nothing is uploaded, and none of these actions marks the Invoice sent; that stays a separate explicit toggle.

**Blocked by:** 04.

**Status:** resolved

- [x] Bagikan uses the Web Share API with the PNG file when file sharing is supported.
- [x] Where file sharing is unavailable, Bagikan downloads the PNG and exposes the WhatsApp action instead.
- [x] A separate WhatsApp action opens the existing deep-link pattern with an invoice message that names the client and the invoice number, tested as a pure message builder.
- [x] The PNG shared or downloaded is the same image the preview shows.
- [x] No sharing action uploads anything or changes the sent state.

## Comments

- 2026-10-21 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - The invoice dialog gained a "Kirim ke klien" block. Bagikan shares the preview's exact PNG Blob through `navigator.share({ files })` when `canShare` accepts the file; otherwise it downloads that Blob. A cancelled share sheet stays a cancellation, while an unsupported browser goes straight to the download. The copy says plainly that neither action uploads anything or marks the Invoice sent.
  - Added `src/lib/invoice-share.ts`: `canShareFile`, `invoicePngFileName` and `shareInvoicePng`, with the navigator and download sink injectable for tests. `InvoicePreview` now reports the Blob it drew, so Bagikan never renders a second picture that could differ from the preview.
  - Added the invoice WhatsApp builder `buildInvoiceWaMessage` / `buildInvoiceWaLink`: it opens the client's conversation with "Halo {client}, berikut invoice {number} untuk booking Anda." The action sits beside Bagikan and is the two-step path after a download.
  - Tests: new `invoice-share.test.ts` covers support detection, the shared file, the unsupported download, cancellation, share-failure fallback and filenames; `wa-messages.test.ts` covers the invoice message and link. `npm run typecheck` clean; `npm run build` succeeds; full `vitest run` 574 passed across 60 suites.
  - Code review fixed the ticket-reference comment style, a value-based settings comparison instead of object identity, the share-function non-null assertion, a too-early object-URL revoke, and misleading "Menyiapkan PNG" text when the preview failed.
