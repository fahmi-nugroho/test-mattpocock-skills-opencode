# 04: Record Bagian MUA privately

**What to build:** The admin can enter the actual amount the MUA kept from a Booking, including when collaborators received a share. During settlement, the Agreed Total is the editable suggestion when **Bagian MUA (Rp)** is blank.

**Blocked by:** 01 (Record Pelunasan and issue a LUNAS Invoice).

**Status:** ready-for-agent

- [ ] The admin can create or edit a Booking with an optional Bagian MUA in whole rupiah. A blank value means unknown and Rp0 means the MUA kept nothing. A known amount requires an Agreed Total and must be between zero and that total. Validate the range when either amount changes.
- [ ] During **Catat Pelunasan**, a blank Bagian MUA suggests the Agreed Total. The admin can accept it, lower it, or clear it before saving. For a Rp1.500.000 Booking with Rp600.000 going to a collaborator, the admin can save Rp900.000.
- [ ] A previously entered value, including Rp0, is preserved unless the admin explicitly changes it. Save Pelunasan and the reviewed Bagian MUA together so a failed attempt cannot partially record the action.
- [ ] Bagian MUA stays within authenticated admin Booking data. Invoice snapshots, preview and export, the Calendar Mirror, and public responses exclude it. An edit to Bagian MUA alone leaves Invoice issue decisions, Payment Status, and remaining balance unchanged.
- [ ] Existing Booking, Invoice, Calendar Mirror, and public contract tests cover the amount rules, persistence, and privacy. Check the suggested, changed, cleared, and previously entered values in the existing settlement form.
