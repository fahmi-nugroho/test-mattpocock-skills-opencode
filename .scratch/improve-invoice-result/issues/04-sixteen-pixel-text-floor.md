# 04: 16 px text floor

**What to build:** No text on the Invoice picture is smaller than 16 px, so amounts and labels survive WhatsApp recompression. Every size, spacing step and wrapping width that was tuned to the old 12–15 px text is re-flowed to match, keeping the cream, typewriter, gold identity, the margins and the content from tickets 01–03.

**Blocked by:** 03 (Payment section follows Payment Status).

**Status:** ready-for-agent

- [ ] Every text operation in the draw list has a size of at least 16.
- [ ] Re-flowed content still stays inside the page margins (including the long-name, long-venue and em-dash cases), with no overlapping rows in both Payment Status states.
- [ ] The focal `SISA PEMBAYARAN` figure is still drawn larger than the other money rows.
- [ ] Layout tests assert the size floor and the margin and ordering invariants through the existing layout seam.
