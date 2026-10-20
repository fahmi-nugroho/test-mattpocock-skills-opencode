# 03: Correct, send and delete an Invoice

**What to build:** An Invoice the admin has issued can be managed without ever rewriting what a client already received. An unsent Invoice can have its issue and due dates corrected, but the issue date may not leave the year encoded in its number; a sent Invoice offers no date edit. Marking an Invoice sent, and unmarking it again, is an explicit action that never happens automatically — sharing an image does not claim delivery. A mistaken Invoice can be deleted behind a two-click confirmation, and an unsent newest Invoice's number becomes available to the next issue instead of leaving a skip. A sent Invoice stays exactly as recorded.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Mark sent and unmark go through an adapter that writes and clears the sent timestamp, verified with a mocked client.
- [ ] The sent state shown in the list and on the booking row updates after either action without a page reload.
- [ ] An unsent Invoice's two dates can be edited through an adapter; the issue date cannot leave its number's year, and `due_on >= issued_on` still holds.
- [ ] A sent Invoice exposes no date editing.
- [ ] Delete is behind a two-click confirmation and goes through an adapter; the list and the booking-row count update at once.
- [ ] The next number is always highest + 1, so deleting the newest unsent Invoice reuses its number rather than skipping it.
- [ ] A sent Invoice remains as history when a corrected Invoice is issued; the series advances rather than rewriting the old row.
