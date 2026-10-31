# 05: Page grows with content

**What to build:** The Invoice page is at least 1600 px tall and grows when the content needs more, so a long venue or client name never pushes the footer off the page. The layout reports the page height itself, the painter sizes the canvas from that height, and the width (900), margin (72) and 2× backing scale are unchanged. The thank-you always sits below all other content. A short Invoice is still exactly 900×1600.

**Blocked by:** 04 (16 px text floor).

**Status:** ready-for-agent

- [ ] A short Invoice reports a 900×1600 page; the page width stays 900.
- [ ] An Invoice with long wrapped content reports a taller page, every mark lies inside it, and the thank-you is below all other content.
- [ ] The preview, download and share still use the exact same picture, drawn at the reported size.
- [ ] The layout tests replace the pinned `{900, 1600, 72}` assertion with minimum-height and growth assertions through the existing layout seam.
- [ ] Marks stay inside the margins at the reported size, and the sharing, numbering and schema tests stay green.
