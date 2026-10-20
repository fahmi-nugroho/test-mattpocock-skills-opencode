# 04: Draw the Invoice picture

**What to build:** Selecting an Invoice renders its saved snapshot as the cream-paper, double-ruled invoice the artist already sends: business name, WhatsApp number and Instagram; the invoice number and both dates; the client; one line item with the event type beneath the service; subtotal, DP, remaining balance, Payment Status and the fixed non-refundable note; the payment block with bank name, account name and account number; the Format Order block with the event date, event type, headcount, hairdo, venue, client phone and start/finish times; and the script "Thank You". The page is 900×1600 and exports as a crisp PNG at twice the backing scale, previewed in the dialog from the saved Invoice rather than the live Booking. A missing payment setting prints an em dash instead of hiding its block, and a font that fails to load degrades to a fallback rather than blocking the render.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] A pure layout model takes the snapshot, the business details and an injected text-measurement function, and returns an ordered list of draw operations; tests assert content, order, margins, alignment and wrapping, with no canvas pixels.
- [ ] Every block and label above appears, with amounts rendered through the existing IDR formatter in one `Rp 200.000` shape.
- [ ] Invoice dates print in English month format; the event date prints in Indonesian format; the template's English labels with Indonesian values are preserved.
- [ ] An empty bank name, account name, account number or Instagram handle prints an em dash and never hides its block.
- [ ] Payment Status and remaining balance in the picture come from the stored snapshot, so the picture cannot disagree with the Invoice.
- [ ] The painter executes the operation list on a canvas at a 2× backing scale and exports PNG; it adds no content or layout decisions of its own.
- [ ] The new body, script and italic display faces load through the existing font pipeline and are awaited before drawing, with a fallback that still renders the invoice if they fail.
- [ ] The dialog previews the selected saved Invoice, so what the admin sees is exactly what is stored.
