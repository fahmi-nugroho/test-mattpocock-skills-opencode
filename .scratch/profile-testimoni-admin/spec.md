# Spec: Admin-Editable Profil & Testimoni

Status: ready-for-agent

## Problem Statement

Profil (headline, subcopy, foto, statistik) dan daftar Testimoni di landing masih statis — tertulis langsung di kode dan hanya bisa diubah oleh developer. Admin (makeup artist, non-teknis) butuh mengubah info profil dan review klien sendiri dari dashboard, agar landing tetap segar tanpa deploy ulang.

## Solution

Jadikan Profil dan Testimoni sebagai konten yang dikelola admin: satu section/tab baru "Profil & Testimoni" di dashboard admin yang sudah ada, dengan form edit profil (headline, subcopy, portrait upload atau tempel URL) plus CRUD daftar statistik dan daftar testimoni (tambah/ubah/sembunyikan/hapus, dengan urutan). Landing publik membaca data ini live dari database; bila database masih kosong, landing tetap menampilkan konten bawaan yang ada sekarang agar tidak blank.

## User Stories

1. As an admin, I want to edit headline profil, so that tagline landing sesuai branding terbaru.
2. As an admin, I want to edit subcopy/deskripsi profil, so that penjelasan layanan selalu akurat.
3. As an admin, I want to upload foto portrait baru, so that foto diri terbaru tampil di hero.
4. As an admin, I want to paste portrait image URL manually as alternative to upload, so that saya bisa memakai foto yang sudah online.
5. As an admin, I want to preview portrait sebelum menyimpan, so that saya yakin foto yang benar.
6. As an admin, I want to mengganti portrait dan foto lama terhapus dari penyimpanan, so that storage tidak bocor.
7. As an admin, I want to menambah stat profil (value + label, mis. "10+ Tahun / Pengalaman"), so that pencapaian baru bisa dipamerkan.
8. As an admin, I want to mengedit stat profil yang ada, so that angka/label bisa dikoreksi.
9. As an admin, I want to menyembunyikan stat tanpa menghapusnya, so that saya bisa bereksperimen dengan tampilan.
10. As an admin, I want to menghapus stat, so that info usang hilang permanen.
11. As an admin, I want to mengatur urutan stat, so that urutan tampil sesuai prioritas.
12. As an admin, I want to menambah testimoni (quote + nama klien), so that review positif baru tampil.
13. As an admin, I want to mengedit testimoni yang ada, so that typo bisa diperbaiki.
14. As an admin, I want to menyembunyikan testimoni tanpa menghapusnya, so that saya bisa kurasi yang tampil.
15. As an admin, I want to menghapus testimoni, so that review yang tidak relevan hilang.
16. As an admin, I want to mengatur urutan testimoni, so that testimoni terbaik tampil duluan.
17. As an admin, I want to melihat validasi yang jelas saat input salah (kosong, terlalu panjang, format URL buruk), so that saya tahu cara memperbaikinya.
18. As a client on mobile, I want to see profil terbaru (headline, subcopy, portrait, stats) on next load after admin saves, so that info yang saya baca selalu terkini.
19. As a client, I want to see daftar testimoni terbaru dengan urutan yang benar, so that saya percaya pada kualitas layanan.
20. As a client, I want to tetap melihat konten profil/testimoni bawaan bila admin belum mengisi database, so that landing tidak pernah blank.
21. As a client, I want to tetap melihat portrait fallback (cover portfolio pertama) bila admin belum upload portrait, so that hero tetap bergambar.

## Implementation Decisions

- Modules: public landing hero block (profil + stats + testimoni + portrait) dan admin dashboard section baru "Profil & Testimoni" (form profil + stats manager + testimonials manager), mengikuti pola manager yang sudah ada untuk portfolio dan layanan.
- Profil shape: single-row settings yang diperluas dengan headline, subcopy, portrait URL. Statistik dan testimoni adalah koleksi terpisah, masing-masing dengan value/label atau quote/nama plus sort order dan visible flag — konsisten dengan pola active/visible + sort pada layanan dan portfolio.
- Public reads: daftar testimoni dan statistik yang visible dibaca anon dengan filter flag + order by sort (pola yang sama dengan daftar publik yang sudah ada). Tidak ada data PII sensitif di kedua tabel ini sehingga anon SELECT dengan RLS cukup; tidak perlu RPC khusus seperti nomor WA.
- Admin writes: full CRUD via authenticated role (single-admin model, sama seperti tabel lain). Validasi input murni di lapisan admin (required, max length, URL shape, sort integer >= 0).
- Portrait handling: reuse mekanisme upload gambar admin yang sudah ada (upload ke storage publik + simpan public URL + hapus objek lama best-effort saat diganti/dihapus). Field URL manual tetap diterima sebagai fallback. Bila portrait kosong, gunakan cover portfolio pertama sebagai fallback (perilaku yang sudah ada dipertahankan).
- Limits & validation (disepakati): stats maksimal 4 tampil, testimoni maksimal 6 tampil; quote maksimal 300 karakter; label/value stat maksimal 40 karakter; headline maksimal 120 karakter; subcopy maksimal 300 karakter; portrait harus HTTPS image URL atau hasil upload.
- Landing data loading: fungsi pemuat data landing diperluas untuk mengambil profil + stats + testimoni bersamaan dengan layanan/portfolio/nomor WA yang sudah ada; kegagalan backend tetap membuat landing readable (section kosong atau fallback bawaan, bukan 500).
- Fallback: konstanta hardcoded stats/testimoni yang ada sekarang dipertahankan sebagai fallback bila query mengembalikan daftar kosong.
- Auth: tidak ada perubahan — memakai browser-session guard dan Supabase Auth email+password yang sudah ada.
- Glossary (kandidat `GLOSSARY.md` saat build):
  - Profil — headline + subcopy + portrait + daftar Stat; single instance, disimpan di settings row.
  - Stat — pasangan value + label (mis. "500+" / "Klien"), dengan sort + visible.
  - Testimoni — quote + nama klien, dengan sort + visible; tampil maksimal 6 di landing.

Agreed seams with user:
- PUBLIC READ — reuse ordered-public-list seam untuk tabel testimoni + stat baru (anon SELECT where visible, order by sort), plus perpanjangan props hero block dan pemuat data landing; fallback portrait seam dipertahankan.
- ADMIN WRITE — mirror CRUD helpers + pure validate functions yang sudah ada untuk portfolio/layanan; reuse upload-image seam untuk portrait.
- SETTINGS — perluasan single-row settings read/update dengan headline/subcopy/portrait URL.

## Testing Decisions

- Good test = external behavior only: given input admin → assert validated output atau error message; given rows + flag/sort → assert public list yang dikembalikan (hanya visible, terurut); given empty DB → assert fallback bawaan dipakai; given file → assert URL tersimpan dan objek lama dibersihkan (best-effort). No DB live, no component internals.
- Modules tested: pure validators (profil/testimoni/stat), public-list query helpers (flag filter + sort order), portrait fallback resolver.
- Prior art: pola test yang sudah ada untuk hero portrait fallback, admin settings validation, public settings fetch, admin portfolio CRUD, dan storage upload/delete cleanup. Ikuti gaya Vitest unit yang sama (mock Supabase client berbentuk loose structural surface, bukan integration DB).

## Out of Scope

- Sistem rating bintang interaktif atau form "tulis review" oleh pengunjung — testimoni tetap dikurasi admin, bukan user-generated.
- Rich text / markdown pada headline/subcopy/quote — plain text saja.
- Crop/resize gambar portrait di browser — upload apa adanya seperti portfolio.
- Realtime live-update di tab yang sudah terbuka — "instantly" berarti next load, sama seperti portfolio/harga sekarang.
- Migrasi konten hardcoded ke DB otomatis (backfill) — fallback kode cukup; admin mengisi manual setelah rilis.
- Multi-bahasa atau versioning/history konten profil.

## Further Notes

- RLS harus meniru pola yang ada: anon hanya SELECT rows visible (testimoni/stat), authenticated full CRUD; settings tetap anon-denied kecuali kolom publik yang diekspos via pola yang sudah disepakati.
- Perlu satu migrasi schema baru + satu migrasi RLS/storage (bucket reuse atau bucket profil baru + kebijakan public-read/authenticated-write yang konsisten).
- Admin tab baru harus mengikuti pola hash-driven tab state agar survive reload.
