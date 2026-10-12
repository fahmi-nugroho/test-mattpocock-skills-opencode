## Problem Statement

As a client browsing on mobile, the landing feels plain and low-trust (text-only hero, equal-weight price cards, small portfolio thumbnails), so I hesitate to start a WhatsApp chat. As the admin/owner, the dashboard is one long narrow scroll with no navigation, so managing bookings, blocks, portfolio, and prices is slow.

## Solution

Evolve the landing in place into a warm, elegant, premium beauty feel (Tailwind only, Indonesian copy, WA-first flow unchanged) that lifts trust and WA clicks, then give the admin dashboard navigation and density plus a light login polish. Mobile-first 360px baseline; desktop enhances to wider grids. No new booking flow, no payments, no schema migration.

## User Stories

1. As a client on mobile, I want a 2-column hero (copy left, portrait right, stacked on mobile) with clear CTAs, so that I immediately understand the offer.
2. As a client, I want to see a trust row (years, clients count, rating) in the hero, so that I trust the artist.
3. As a client, I want to read 2-3 short testimonials below the hero, so that social proof reassures me.
4. As a client, I want portfolio category pills that filter styles, so that I can find a look I like.
5. As a client, I want to tap a portfolio thumbnail to open a larger lightbox with title and category, so that I can judge detail.
6. As a client, I want prev/next and keyboard/backdrop close in the lightbox, so that browsing feels effortless.
7. As a client, I want a "Tanya gaya ini via WA" button in the lightbox with prefilled style message, so that I can ask without typing.
8. As a client, I want price cards with big IDR price and subtle duration, so that cost is scannable.
9. As a client, I want one "Paling Dipilih" badge on the top-sorted active service, so that choice is guided.
10. As a client, I want per-service WA buttons with prefilled service name, so that inquiry is one tap.
11. As a client, I want a month calendar with Tersedia / Penuh / Tutup colors and legend, so that I know roughly when to ask.
12. As a client, I want to tap a future day to see occupied time ranges and a single WA CTA, so that I can propose a time in chat.
13. As a client, I want a floating WA button always visible, so that I can chat from anywhere.
14. As a client, I want serif display headings with warm neutrals that still read well on small screens, so that the brand feels premium yet legible.
15. As an admin, I want a sticky tab bar (Ringkasan | Kalender | Booking | Blokir | Portfolio | Harga | Pengaturan) with hash deep-links, so that I can jump sections.
16. As an admin, I want a wider denser dashboard layout on desktop, so that lists and calendar use space.
17. As an admin, I want search in booking/block/portfolio/service lists, so that I find rows fast.
18. As an admin, I want to control the "Paling Dipilih" badge by sort order, so that no migration is needed.
19. As an admin, I want login with matching branding, show/hide password, and clear Indonesian errors, so that sign-in feels part of the app with auth logic unchanged.

## Implementation Decisions

- Landing structure: widen from narrow single column to wide responsive container; hero becomes 2-col on desktop (copy + portrait), stacked mobile; portfolio and prices go 2-col mobile / 3-col desktop; calendar and WA float unchanged in flow.
- Brand tokens: warm elegant Tailwind evolution — stone/rose neutrals, deep espresso/plum text, restrained gold accent; serif display via next/font for H1/H2 only, sans body; existing green/amber/red day-status semantics kept, restyled to warm-tinted shades with stronger selected ring.
- Hero proof content: hardcoded stats + 2-3 testimonials in one editable location; hero portrait supplied by owner, fallback reuses an existing visible portfolio cover when missing; no new table.
- Portfolio lightbox: keeps existing category filter behavior; new pure WA message builder for style inquiry (title + category prefill) reusing the existing wa.me link builder; focus management and ESC/backdrop close.
- Featured badge rule: pure selector returns first active service by ascending sort, else null; badge copy "Paling Dipilih"; owner controls via sort field; no schema change.
- Jadwal: legend and detail panel keep Tersedia/Penuh/Tutup labels; detail panel consolidates to a single primary WA CTA; past days stay inert and muted.
- Admin nav: sticky top tab bar with hash routing to existing sections (overview counts, admin calendar, bookings manager, blocks manager, portfolio manager, services manager, operating settings); page widens on desktop; lists gain client-side search and denser rows; all CRUD and RLS behavior unchanged.
- Login polish: same email+password flow and session guard; adds brand header, warm background, show/hide password toggle, accessible Indonesian error copy.
- Copy/i18n: all Indonesian, id-ID dates, IDR formatting reuse; WA templates reuse general/service/date starters plus new style starter.
- Assets: owner supplies logo, 1 hero portrait, 3-5 covers; placeholders from portfolio covers until supplied; next/image lazy loading retained.

## Testing Decisions

- Good test = external behavior only: given service rows assert featured selector; given title/category assert wa.me URL and message; given bookings/blocks/hours assert day-status unchanged. No DB, no component internals or snapshots.
- Modules tested: reuse existing seams (WA link builders, portfolio category filter, IDR formatter, day-status derivation); add two new pure seams (featured-service selector, portfolio style WA link builder).
- Prior art: existing Vitest suites for WA links, portfolio filter, availability/day-schedule, and format; new unit files follow the same pattern.

Agreed seam with user: Reuse + 2 new pure functions (Recommended) — featured selector and portfolio WA prefill, DB mocked, Vitest only.

## Out of Scope

- Online booking form, payments, WA API/webhooks, public signup, multi-admin roles.
- Package comparison table, Supabase migration for featured flag or testimonials table.
- Full rebrand, new UI library, component snapshot or E2E tests.
- Auth logic changes, RLS policy changes, RPC contract changes, realtime updates.

## Further Notes

- Builds on the single Next.js 14 + Supabase + Tailwind app with WA-first negotiation; calendar derivation (blocked if all-day block or full-toggle, else fully_booked if coverage fills operating hours, else available) is unchanged.
- Phase order: Phase 1 landing tokens + hero + lightbox + price badge; Phase 2 admin tabs/density + login polish.
- Glossary in use: Service / Price Item, Portfolio Item, Booking (pending to confirmed / cancelled), Block, Day Status (blocked / fully_booked / available), Operating Settings.

Status: ready-for-agent
