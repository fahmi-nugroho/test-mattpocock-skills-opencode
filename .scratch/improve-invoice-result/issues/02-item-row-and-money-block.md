# 02: Item row and money block

**What to build:** The item row shows the item, the Headcount (`N orang`) and one agreed total, with no QTY and no PRICE column and never price × Headcount. The money block shows the agreed total, the DP and the remaining balance, where the remaining balance is the focal point: a larger gold `SISA PEMBAYARAN`. A badge beside or beneath it shows the Payment Status in capitals (`LUNAS` / `DP DITERIMA`), drawn from the existing derived Payment Status. The event type stays beneath the item name.

**Blocked by:** 01 (Indonesian labels and dates).

**Status:** resolved

- [x] The item row prints the Headcount and exactly one total, and no quantity or unit-price column.
- [x] The printed total is the agreed total on the snapshot, not price × Headcount.
- [x] `SISA PEMBAYARAN` is drawn larger than the other money rows and in the gold colour.
- [x] The badge text always agrees with the remaining balance (`LUNAS` only when the DP is at least the agreed total) and the Payment Status derivation itself is unchanged.
- [x] Layout tests cover the item row, the focal balance and the badge for both `Lunas` and `DP diterima` snapshots.
