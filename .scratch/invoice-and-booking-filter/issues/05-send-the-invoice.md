# 05: Send the Invoice from the phone

**What to build:** "Bagikan" sends the previewed PNG through the phone's own share sheet when the browser supports sharing files. When it does not — a desktop browser, mainly — the same action downloads the PNG so it can be attached by hand, and the dialog still offers opening the WhatsApp conversation with a prefilled invoice message naming the client and the invoice number. Nothing is uploaded, and none of these actions marks the Invoice sent; that stays a separate explicit toggle.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] Bagikan uses the Web Share API with the PNG file when file sharing is supported.
- [ ] Where file sharing is unavailable, Bagikan downloads the PNG and exposes the WhatsApp action instead.
- [ ] A separate WhatsApp action opens the existing deep-link pattern with an invoice message that names the client and the invoice number, tested as a pure message builder.
- [ ] The PNG shared or downloaded is the same image the preview shows.
- [ ] No sharing action uploads anything or changes the sent state.
