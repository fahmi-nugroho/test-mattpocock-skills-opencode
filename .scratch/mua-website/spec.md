# Spec: Makeup Artist Website

Status: ready-for-agent

## Problem Statement

As a makeup artist, I need a responsive public website showing my profile, portfolio, price list with cover images, and a read-only availability calendar (available / fully-booked / blocked), so clients can check availability and contact me via WhatsApp where date/time is negotiated in chat. I also need a private admin dashboard to manage all dates, bookings, portfolio, and prices myself.

## Solution

Build a single Next.js 14 + Supabase + Tailwind app (ID locale, IDR). Public landing is read-only informational; all time/date decisions are admin-managed. Booking happens via `wa.me` deep-links (general + per-service prefill, no date prefill); admin creates `pending → confirmed / cancelled` bookings with time ranges. Calendar day-status is derived from bookings + blocks + manual full-toggle.

## User Stories

1. As a client on mobile, I want to view the artist profile/hero, so that I trust who I'm booking.
2. As a client, I want to browse the portfolio grid with category filter, so that I can see styles.
3. As a client, I want to view the price list with cover image, price IDR, duration, so that I can choose a service.
4. As a client, I want to tap WA on a price item and get a prefilled "Halo, mau tanya [service]" message, so that I don't type from scratch.
5. As a client, I want to see a month calendar with available / fully-booked / blocked days, so that I know roughly when to ask about.
6. As a client, I want a floating/general WA button, so that I can discuss date/time in chat without picking dates on-site.
7. As an admin, I want to log in with email+password at /admin, so that only I can manage content.
8. As an admin, I want to CRUD portfolio items (image upload, title, category, sort, visible), so that landing stays fresh.
9. As an admin, I want to CRUD price items including optional cover image, price, duration, active flag, so that pricing is accurate.
10. As an admin, I want to set WA number, operating hours, so that calendar derivation and WA links are correct.
11. As an admin, I want to create bookings with date + start-end + service + client name/phone + notes + status, so that confirmed work is recorded.
12. As an admin, I want to confirm/cancel/reschedule bookings, so that lifecycle pending → confirmed / cancelled is enforced.
13. As an admin, I want to create full-day or time-range blocks with reason, so that leave/private time shows as blocked.
14. As an admin, I want a manual "mark day full" toggle per date, so that I can close a day without fake blocks.
15. As an admin, I want overlap prevention between confirmed bookings and blocks, so that double-booking can't happen.
16. As an admin, I want an overview of today/upcoming bookings, so that I can plan my day.

## Implementation Decisions

- Modules: public landing (hero, portfolio, prices, calendar-view, WA CTA) + admin (login, overview, portfolio CRUD, prices CRUD, bookings list+calendar, blocks CRUD, settings). Single Next.js App Router codebase.
- Interfaces: `computeDayStatus(date, bookingsForDay, blocksForDay, fullDates, open/close)` → `available | fully_booked | blocked`; `doesOverlap(aStart, aEnd, bStart, bEnd)` for guard; `buildWaLink(number, template)` for general/per-service messages.
- Schema: `services(id, name, description, price_idr, duration_min, active, cover_image_url, sort)`, `portfolio_items(id, title, category, image_url, sort, visible)`, `bookings(id, date, start_time, end_time, service_id, client_name, client_phone, notes, status)`, `blocks(id, date, all_day, start_time, end_time, reason)`, `settings(id=1, wa_number, open_hour, close_hour, full_dates[])`. Storage buckets `portfolio/`, `prices/` public-read.
- API contracts: public reads via RLS (active services, visible portfolio, day-status only — no client PII); admin full CRUD via authenticated role. Month availability via RPC returning day-status array, not raw bookings.
- Auth: Supabase Auth email+password, single admin created manually, no public signup, RLS enforced.
- Calendar rule: `blocked` if all-day block or in full_dates; else `fully_booked` if manual full-toggle coverage or bookings+blocks cover [open,close); else `available` (dot if partial occupancy). Past dates greyed.
- WA: `https://wa.me/62xxx?text=encodeURIComponent(...)`, ID copy, no WA API/webhooks, no payment v1.
- i18n/format: id-ID dates, IDR, responsive mobile-first with next/image lazy load.

Glossary (to become first `GLOSSARY.md` on build):
- Service / Price Item — name, desc, price IDR, duration, active, optional cover image
- Portfolio Item — image, title, category, sort_order
- Booking — admin-created only: date + start_time + end_time + service + client + status pending → confirmed / cancelled
- Block — admin-created: date + all_day OR start-end + reason
- Day Status (public, derived) — blocked / fully_booked / available
- Operating Settings — wa_number, open_hour, close_hour, full_dates

## Testing Decisions

- Good test = external behavior only: given bookings/blocks/hours → assert day-status; given two ranges → assert overlap bool; given inputs → assert wa.me URL. No DB, no component internals.
- Modules tested: the single seam (`computeDayStatus`, `doesOverlap`, `buildWaLink`).
- Prior art: none — greenfield, no existing tests. New Vitest unit file is the first seam; prefer keeping it as the only seam for v1.

Agreed seam with user: Single seam (Recommended) — pure day-status + WA-link functions, DB mocked.

## Out of Scope

- Client time/date picker, online payment, WA API automation, client accounts, multi-admin, analytics, video portfolio, multi-image price galleries, public booking creation.

## Further Notes

- Operating hours defaults TBD at seed (e.g. 09:00–19:00). Portfolio categories capped ~6 for v1. Vercel deploy.
- Stack: Next.js 14 App Router, Tailwind, Supabase (Postgres + Auth + Storage).
- Build steps: 1) Scaffold + env 2) SQL migrations + RLS + storage + seed 3) Public landing + calendar 4) Admin auth + 6 dashboard sections + upload 5) Overlap validation + full-toggle + WA links 6) ID copy, responsive QA, deploy guide.
