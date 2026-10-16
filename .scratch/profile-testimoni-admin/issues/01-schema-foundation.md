# 01: Schema foundation for Profil & Testimoni

**What to build:** Migrated database that can store admin-editable Profil and Testimoni, with public-read / admin-write access enforced, so later UI slices have somewhere to read and write.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Settings single row gains headline, subcopy, portrait URL columns with sensible defaults and length checks
- [ ] New testimonials collection (quote, client name, sort order, visible flag) with sort and visibility indexes
- [ ] New profile stats collection (value, label, sort order, visible flag) with sort and visibility indexes
- [ ] Anonymous role can only read visible testimonials and stats; authenticated admin role has full CRUD on both plus settings update
- [ ] Portrait image storage is publicly readable and writable only by authenticated admin (reuse existing public bucket pattern or add a profile bucket consistently)
- [ ] Migration applies cleanly on a fresh database and landing still renders via existing hardcoded fallback when new tables are empty
