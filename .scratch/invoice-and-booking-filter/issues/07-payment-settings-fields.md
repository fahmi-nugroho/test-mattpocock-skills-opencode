# 07: Edit the payment details once

**What to build:** The Pengaturan section gains bank name, account name, account number and Instagram handle, loaded with the existing WhatsApp number and saved with the same button. Saving normalises the Instagram handle without a leading `@` and reduces the account number to digits, while the existing WhatsApp number rules stay unchanged. Any of the four may be saved empty — the invoice then prints an em dash — so the admin is never blocked from saving the rest.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] The settings read and form carry the four fields and persist them on the single settings row with the existing save action.
- [ ] Validation normalises the Instagram handle without a leading `@` and the account number to digits, with tests.
- [ ] The existing WhatsApp number validation and error message are unchanged.
- [ ] Empty values are accepted and saved, and the invoice falls back to an em dash.
- [ ] Saved values survive a reload and are what the invoice picture prints.
