# 08: Record the Invoice vocabulary and the snapshot decision

**What to build:** The project's language and decision record catch up with the feature. GLOSSARY.md defines Invoice, Invoice Number and Payment Status, and adds the Headcount caveat that an Invoice prints the agreed total rather than price × headcount; it uses no Bill, Receipt, Kwitansi or Tagihan synonym. A new ADR records the frozen-snapshot choice — many Invoices per Booking, each never rewritten — with its consequences (duplicate numbers, numbering noise, the re-send path) and why it is hard to reverse, so a future reader does not "fix" it into a live view.

**Blocked by:** 02, 03, 04.

**Status:** ready-for-agent

- [ ] GLOSSARY.md defines Invoice, Invoice Number and Payment Status in the project's existing format.
- [ ] The Headcount entry gains the caveat that the Invoice prints the agreed total, not price × headcount.
- [ ] No Bill, Receipt, Kwitansi or Tagihan synonym is introduced anywhere.
- [ ] The ADR records the snapshot decision, its context, its consequences and the alternatives rejected.
- [ ] The documentation's names and behaviour match what ships.
