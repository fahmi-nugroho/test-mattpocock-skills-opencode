# 04: Draw the Invoice picture

**What to build:** Selecting an Invoice renders its saved snapshot as the cream-paper, double-ruled invoice the artist already sends: business name, WhatsApp number and Instagram; the invoice number and both dates; the client; one line item with the event type beneath the service; subtotal, DP, remaining balance, Payment Status and the fixed non-refundable note; the payment block with bank name, account name and account number; the Format Order block with the event date, event type, headcount, hairdo, venue, client phone and start/finish times; and the script "Thank You". The page is 900×1600 and exports as a crisp PNG at twice the backing scale, previewed in the dialog from the saved Invoice rather than the live Booking. A missing payment setting prints an em dash instead of hiding its block, and a font that fails to load degrades to a fallback rather than blocking the render.

**Blocked by:** 03.

**Status:** resolved

- [x] A pure layout model takes the snapshot, the business details and an injected text-measurement function, and returns an ordered list of draw operations; tests assert content, order, margins, alignment and wrapping, with no canvas pixels.
- [x] Every block and label above appears, with amounts rendered through the existing IDR formatter in one `Rp 200.000` shape.
- [x] Invoice dates print in English month format; the event date prints in Indonesian format; the template's English labels with Indonesian values are preserved.
- [x] An empty bank name, account name, account number or Instagram handle prints an em dash and never hides its block.
- [x] Payment Status and remaining balance in the picture come from the stored snapshot, so the picture cannot disagree with the Invoice.
- [x] The painter executes the operation list on a canvas at a 2× backing scale and exports PNG; it adds no content or layout decisions of its own.
- [x] The new body, script and italic display faces load through the existing font pipeline and are awaited before drawing, with a fallback that still renders the invoice if they fail.
- [x] The dialog previews the selected saved Invoice, so what the admin sees is exactly what is stored.

## Comments

- 2026-10-20 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - Added the pure `src/lib/admin/invoice-layout.ts`: `layoutInvoice(invoice, business, measure)` returns the ordered fill/rule/text operations for one 900×1600 cream page. It contains the italic display wordmark, WhatsApp and Instagram, `No:`/`Date:`/`Due Date:`/`To:`, one item with the event beneath the service, qty/price/total, SUBTOTAL/DP/PELUNASAN/Payment Status and the fixed non-refundable note, Payment Information, Format Order and the script Thank You. Every value comes from the saved snapshot; business values come from settings.
  - Dates: `formatDateEn` (new, in `format.ts`) prints the Invoice's issue/due dates in English months; the existing `formatDateId` prints the Format Order event date in Indonesian. Amounts go through `formatIDR`, normalised to the one `Rp 200.000` shape. An empty bank name, account name, account number or Instagram handle prints an em dash and keeps its block. Long wordmarks, contacts, client names, payment values and Format Order values wrap against the injected measurement and the page margins.
  - Added the thin `src/lib/invoice-painter.ts`: it resolves the three faces from the next/font variables, awaits `document.fonts.load` with a short timeout and fallbacks, measures with the same context it paints, applies the 2× backing scale using `INVOICE_PAGE`, and exports PNG via `canvas.toBlob`. It adds no content or layout decisions.
  - Fonts now load through `src/app/layout.tsx`: Courier Prime (`--font-invoice-body`, 400/700), Great Vibes (`--font-invoice-script`) and Playfair Display italic alongside the existing normal face.
  - The dialog gained `InvoicePreview`, which renders the selected saved Invoice to a PNG object URL and shows it inline. `BookingsManager` loads the settings row alongside bookings/invoices (`Settings` plus a failure flag) and passes one `invoiceBusiness` projection to the dialog; a failed settings read keeps the bookings usable, prints em dashes and shows a notice instead of pretending the details are configured.
  - Tests: new `invoice-layout.test.ts` (21 pure cases) asserts page/margins, order, content, English/Indonesian dates, one amount shape, the snapshot-derived balance/status, em-dash settings blocks, Format Order labels/values, wrapping under the injected measurement, column alignment/separation and the script footer. `npm run typecheck` clean; `npm run build` succeeds; full `vitest run` 564 passed across 59 suites.
  - Visual check: rendered the operation list to a 900×1600 PNG with the generic fallback stacks to confirm the header, double rules, money column, payment/Format Order blocks and footer do not collide.
  - Code review (standards + spec axes). Fixed: moved the settings projection to `invoice.ts` and the English date formatter to `format.ts`; grouped bank fields as `InvoiceBankDetails`; made the painter import `INVOICE_PAGE` instead of restating dimensions; removed speculative painter exports; wrapped header, client and payment values; strengthened margin/alignment/column tests; surfaced a failed settings read; made the footer sit below the content.
