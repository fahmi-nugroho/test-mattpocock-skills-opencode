# 01: Indonesian labels and dates

**What to build:** The Invoice picture reads entirely in Indonesian. Every printed label and heading is Indonesian (suggested: `Tanggal`, `Jatuh Tempo`, `Kepada`, `Jenis Acara`, `Jumlah Orang`, `Gaya Rambut`, `Jam Mulai`, `Jam Selesai`, `Terima kasih`), while `INVOICE`, `DP` and `Lunas` stay as they are. The issue and due dates print in Indonesian long form without a weekday (for example `21 Oktober 2026`); the Event Date keeps its weekday. Nothing else about the layout changes. The admin sees the new wording the next time any Invoice, old or new, is previewed, downloaded or shared.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No English label or heading remains on the picture (identity block, Payment Information, Format Order, thank-you).
- [ ] Issue and due dates print in Indonesian long form without weekday; the Event Date still prints with its weekday.
- [ ] Style still prints through the existing `Hijabdo` / `Hairdo` mapping, and the printed label for Style is decided between `Gaya Rambut` and the shorter `Gaya` (the glossary lists "hairstyle" as a term to avoid).
- [ ] The pure layout tests assert the Indonesian labels and dates through the existing layout seam; the English-label assertions are replaced.
- [ ] Sharing, numbering, schema and share-message tests stay green.
