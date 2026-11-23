# 03: Correct a recorded Pelunasan

**What to build:** The admin can explicitly undo a recorded Pelunasan, correct the Agreed Total or DP, and record the correct final payment. Previously issued Invoices remain available with the facts recorded at issue.

**Blocked by:** 01 (Record Pelunasan and issue a LUNAS Invoice).

**Status:** resolved

- [x] The Booking offers an explicit undo action when it has a recorded Pelunasan. The action clears that payment only and recalculates the outstanding balance from the saved Agreed Total and DP.
- [x] While Pelunasan is recorded, the admin is directed to undo it before editing the Agreed Total or DP. After undo, the admin can correct those amounts and use **Catat Pelunasan** to record the new outstanding balance in full.
- [x] Undo and re-recording preserve previously issued Invoices, including their payments, dates, Payment Status, and sent mark. A newly issued Invoice reflects the corrected Booking and uses the existing Invoice Number series.
- [x] Failed writes surface an error and leave the saved Booking consistent. Existing admin operation and Invoice tests cover undo, the amount edit guard, re-recording, and preservation of prior Invoices.

## Comments

- Verified with typechecking, all 741 tests, a local PostgreSQL smoke test for persisted Invoice history, and mobile Chromium for the admin correction flow.
