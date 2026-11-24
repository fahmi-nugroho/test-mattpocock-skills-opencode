---
target: Wandana Makeup admin and all sections
total_score: 22
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
target_identity: "file:/home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/admin/page.tsx"
target_fingerprint: "sha256:233255933e4de090030170ad4005372d5f2035c2bb380899ca2098c1deb4df06"
target_path: /home/fahmi/projects/pribadi/test-mattpocock-skills-opencode/src/app/admin/page.tsx
timestamp: 2026-11-24T04-42-07Z
slug: src-app-admin-page-tsx
closed: true
---
Method: dual-agent (A: admin_design · B: admin_detector)

# Wandana Makeup admin critique

The dashboard has the right jobs for the artist’s workflow. The “Perlu tindakan” overview, date details, row confirmations, and invoice lifecycle are grounded in how bookings happen. The biggest issue is an unsafe request handoff that can mix two clients’ drafts. Routine work also requires moving from an overview to a section to a list dialog.

## Design health

| # | Nielsen heuristic | Score |
|---|---|---:|
| 1 | Visibility of system status | 3/4 |
| 2 | Match to the real world | 2/4 |
| 3 | User control and freedom | 2/4 |
| 4 | Consistency and standards | 3/4 |
| 5 | Error prevention | 2/4 |
| 6 | Recognition | 2/4 |
| 7 | Flexibility and efficiency | 2/4 |
| 8 | Aesthetic and minimalist design | 2/4 |
| 9 | Error recovery | 2/4 |
| 10 | Help and documentation | 2/4 |
| | **Total** | **22/40 · Acceptable** |

Loading and row confirmations help the artist trust individual operations. Review actions are slower to reach, and the request handoff makes the form state difficult to trust.

## Priority issues

1. **P1 · Start a clean booking draft from each request.** Reproduced with an unsaved manual draft. Jadikan Booking switched to the incoming client while retaining the previous draft’s confirmed status, DP and notes. The handoff only sets date and times provided by the request. Customer notes remain in the request. Use a clean, visibly linked draft, protect unfinished work, default to Menunggu and zero DP, and display the request notes separately from private notes. If the booking saves and linking fails, expose the saved booking so the owner can recover without recreating it. `$impeccable harden` · [Booking prefill](../../src/components/admin/bookings-manager.tsx#L662) · [Request mapping](../../src/lib/admin/booking-request.ts#L319)
2. **P1 · Jump directly to the work queue.** Buka Permintaan changes sections and drops focus to BODY on both viewport sizes. The artist has to open the list dialog and choose a filter. Show review queues inline, deep-link to relevant rows or filters from Ringkasan, and focus the destination heading or queue. Keep create actions visible. `$impeccable distill` · [Tab switching](../../src/components/admin/admin-dashboard.tsx#L197) · [Request queue](../../src/components/admin/requests-manager.tsx#L774)
3. **P1 · Show workload and public availability separately.** Chromium showed a green Tersedia date beside a confirmed 10:00–12:00 booking. The month offers no signal of already scheduled work, and on mobile the day details sit below the grid. Add confirmed, pending, and time-block markers, name the public inquiry state clearly, and bring the selected day’s summary and booking shortcuts into reach. `$impeccable layout` · [Calendar](../../src/components/admin/admin-calendar.tsx#L203)

## Section-by-section

| Screen | What works and what to improve |
|---|---|
| Login | Compact and branded, with password visibility and autofill. Enlarge touch targets and make account recovery discoverable through the supported owner workflow. |
| Ringkasan | “Perlu tindakan” separates work from counts. Show pending rows or filter destinations and differentiate zero work, loading, and failed reads. |
| Kalender | Desktop month and day details fit side by side. Add workload markers and direct links from a day to its bookings. |
| Booking | Scheduling, client, services and payment are grouped. “Ubah Jadwal” edits more than schedule. Group row actions by task. Label the editor by scope and give status/next action prominence. |
| Invoice | The saved snapshot and send status are useful. Give the existing invoice and preview priority when one is selected. Show Terbitkan, Bagikan and Tandai terkirim as distinct steps. |
| Permintaan | Prefill, copy, resend, reissue and search support real work. Put one next action on each state; move resend/reissue/deletion controls to secondary placement. Make the request status “Diisi klien” clearer than “Terkirim.” |
| Blokir | Confirmations name the chosen date and public effect. “Sehari penuh” and “Tandai penuh” look like interchangeable ways to close a day. Name the choices by what they do and explain reopening. |
| Portfolio | Thumbnails and visibility help scanning. Show a preview before upload and explain the Urutan direction and its effect on the opening photo. |
| Harga | Visible active state and clear IDR fields. Make descriptions multiline with guidance for package inclusions. Explain how rank controls Layanan unggulan. |
| Profil & Testimoni | Explicit publication controls work. Explain that the profile portrait is the fallback when a portfolio photo leads. Add jump links on mobile and show which achievements and testimonials fall within the public limits. |
| Pengaturan | Contact and bank details are grouped. Show where the fields appear. In Google Calendar, distinguish last verified from last successful sync and link dashboard warnings directly to the status panel. |

## People and cognitive load

A busy owner returns from WhatsApp to a useful action count, then loses momentum in a second list entry and several row actions. The interrupted owner is exposed to the stale-draft bug. The keyboard-only owner loses the destination after a shortcut, while the separate request handoff does focus the booking form. Five request filters plus search and refresh, up to six booking row actions, and multiple close-date concepts make the queues moderate to high load.

## Detector evidence

Source scan found zero primary findings and one advisory for the 11px Google Calendar mirror status badge in bookings-manager.tsx:1219. In headless Chromium, admin login, Ringkasan, and Booking overlays ran. Cream and Inter match the intentional design system. The booking form’s optional labels are helpful. A grouped optional subsection would reduce repetition.

## Follow-up questions

- Which should lead the fix pass? Request handoff and form recovery, admin queues and calendar, or both?
- After the priority fixes, should the pass include the catalog, profile, invoice, and settings refinements?
