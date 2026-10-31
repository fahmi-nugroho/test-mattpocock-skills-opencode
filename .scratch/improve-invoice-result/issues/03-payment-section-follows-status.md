# 03: Payment section follows Payment Status

**What to build:** Payment instructions depend on the Invoice's Payment Status. A `DP diterima` Invoice shows the Payment Information block (bank, account name, account number, an em dash for any empty setting), the prompt `Mohon lunasi sebelum {Jatuh Tempo}` with the due date, and the note `DP tidak dapat dikembalikan.`. A `Lunas` Invoice omits all three and prints a payment-complete confirmation instead. An empty bank setting on a `DP diterima` Invoice still prints its block with em dashes, so a missing setting is visible.

**Blocked by:** 02 (Item row and money block).

**Status:** ready-for-agent

- [ ] `DP diterima`: bank block, due-date prompt with the correct Indonesian date, and the non-refundable note are all present.
- [ ] `DP diterima` with empty bank settings: the block remains, each empty value is an em dash.
- [ ] `Lunas`: no bank block, no due-date prompt, no refund note, and a payment-complete confirmation is present.
- [ ] Layout tests cover both states through the existing layout seam, replacing the always-print-bank assertion.
- [ ] The earlier invoice spec is left unchanged; this ticket narrows its stories 5 and 6.
