# MUA Website — Makeup Artist Portfolio & Booking via WhatsApp

A lightweight Next.js + Supabase website for a makeup artist (MUA): public landing with portfolio, price list, and availability calendar — all bookings negotiated via WhatsApp, no customer accounts. Plus a guarded admin dashboard to manage bookings, blocks, portfolio, services, and operational settings.

Live public flow: **see work → pick service → check date → chat on WhatsApp**.

## Features

### Public landing (`/`)
- **Hero** with WhatsApp CTA + price-list anchor
- **Portfolio** (`PortfolioGrid`) — visible items only, filterable by category
- **Price & Services** (`PriceList`) — active services only, per-service WA deep link with prefilled message
- **Availability calendar** (`AvailabilityCalendar`) — month view from `get_month_availability` RPC, day detail from `get_day_schedule` RPC, WA link per date
- **Floating WA button** (`WaFloat`) — always-visible contact
- **Resilient:** page stays readable with empty sections + WA fallback if Supabase is unreachable (`revalidate = 0`, no ISR cache)

### Admin dashboard (`/admin`, `/admin/login`)
Guarded by Supabase Auth browser session — unauthenticated visits redirect to `/admin/login`.

- **Ringkasan Booking** — today / upcoming counts (confirmed + pending)
- **Kalender Booking** — same status derivation as public calendar
- **Booking manager** — record WA negotiation results, confirm / cancel (drives public calendar status)
- **Blokir & Tanggal Penuh** — all-day or time-range blocks + manual full-date toggles, with conflict rejection vs confirmed bookings
- **Portfolio manager** — CRUD + visibility toggle, Supabase Storage uploads with validation
- **Services manager** — CRUD + active toggle, price / duration validation
- **Pengaturan Operasional** — `wa_number` (single-row `settings id=1`, read live by public RPCs)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS 3 |
| Backend | Supabase (Postgres + Auth + Storage + RPC) |
| Client lib | `@supabase/supabase-js` v2 |
| Language | TypeScript (strict) |
| Tests | Vitest (30 suites under `src/lib/__tests__/`) |

## Project Structure

```
src/
  app/
    page.tsx            # public landing (server component, revalidate=0)
    layout.tsx          # root layout (lang="id", metadata)
    icon.svg            # app icon (serif W on the espresso tile)
    admin/
      page.tsx          # dashboard route (server; title; renders AdminDashboard)
      login/page.tsx    # sign-in route (server; title; renders AdminLogin)
  components/
    portfolio-grid.tsx
    price-list.tsx
    availability-calendar.tsx
    wa-float.tsx
    admin/
      admin-dashboard.tsx admin-login.tsx
      admin-calendar.tsx  bookings-manager.tsx  blocks-manager.tsx
      portfolio-manager.tsx services-manager.tsx
  lib/
    availability.ts / calendar.ts / day-schedule.ts / month-availability.ts
    format.ts / whatsapp.ts / portfolio.ts
    admin/              # validation, overview, conflicts, schedule-events
    supabase/           # client.ts, server.ts, queries.ts, database.ts,
                        # admin-*.ts, public-settings.ts
supabase/
  migrations/
    0001_schema.sql .. 0009_day_schedule_free.sql
    (schema, RLS, storage, seed, RPCs: get_month_availability,
     get_day_schedule, get_public_wa_number)
```

Key domain types (`src/lib/supabase/database.ts`): `Service`, `PortfolioItem`, `Booking (pending|confirmed|cancelled)`, `Block`, `Settings`, `MonthAvailabilityRow`, `DayScheduleRow`.

## Prerequisites

- Node.js 20+
- npm
- A Supabase project (URL + anon key + service-role key for migrations)

## Getting Started

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# then edit .env.local (see table below)

# 3. Apply database migrations (requires service-role key locally)
# via Supabase CLI or dashboard SQL editor, in order:
# supabase/migrations/0001_schema.sql → 0009_day_schedule_free.sql

# 4. Run dev server
npm run dev
# → http://localhost:3000       (landing)
# → http://localhost:3000/admin (dashboard)
```

Create an admin user in Supabase Dashboard → Authentication → Users, then sign in at `/admin/login`.

## Environment Variables

| Variable | Scope | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | yes | e.g. `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | yes | public anon key (RLS applies) |
| `NEXT_PUBLIC_WA_NUMBER` | browser | no | WA fallback (e.g. `6280000000000`) when settings RPC unreachable; admin-managed `wa_number` wins at runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | yes (local/ops) | apply migrations + backfills. **Never** prefix with `NEXT_PUBLIC_`, never commit |

`.env.local` is gitignored — never commit real keys.

## Scripts

```bash
npm run dev        # next dev
npm run build      # next build
npm run start      # next start (production)
npm run lint       # next lint
npm run test       # vitest run (all suites)
npm run typecheck  # tsc --noEmit
```

## Supabase Backend

- **Tables:** `services`, `portfolio_items`, `bookings`, `blocks`, `settings` (single row `id=1`) — see `0001_schema.sql`.
- **RLS:** public read on active/visible rows + public RPCs; writes restricted to `authenticated` (admin) — see `0002_rls.sql`.
- **Storage:** portfolio / service covers bucket — see `0003_storage.sql`.
- **RPCs:**
  - `get_public_wa_number() → text`
  - `get_month_availability(p_year, p_month) → [{date, status}]` where `status ∈ available|fully_booked|blocked`
  - `get_day_schedule(p_date) → {status, all_day_blocked, occupied[], free[]}`
- **Seed:** placeholder settings row — see `0004_seed_rpc.sql`.

Day columns stay `date + "HH:MM"` text (no timestamptz) — the shared seam between `Booking`/`Block` rows and the `BookingForDay`/`BlockForDay` logic in `src/lib/availability.ts`.

## Admin Workflow

1. Customer checks portfolio → price → calendar, then chats via WA deep link (message prefilled with service/date).
2. Negotiation happens in WhatsApp (outside the app).
3. Admin records the outcome in `/admin` → **Booking** (pending → confirmed / cancelled).
4. Public calendar updates on next load (no realtime subscription in v1).
5. Use **Blokir** for time off and **Tanggal Penuh** for manually full days; **Pengaturan** for WA number.

## Testing

```bash
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
```

30 test files under `src/lib/__tests__/` cover: availability derivation, calendar helpers, WA link builders, all admin validators, and Supabase query wrappers (mocked client).

## Deployment

Any Next.js host (Vercel recommended):

1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, (optional) `NEXT_PUBLIC_WA_NUMBER` in host env.
2. Do **not** set `SUPABASE_SERVICE_ROLE_KEY` on the hosting env (local/CI migrations only).
3. `npm run build && npm run start` — Supabase remote host must allow images (already `remotePatterns: { protocol: "https", hostname: "**" }` in `next.config.js`).

## Notes / Conventions

- UI language is Indonesian (`lang="id"`).
- Times are `"HH:MM"` strings, dates `"YYYY-MM-DD"` — validated in `src/lib/admin/validate-*.ts`.
- Schedule mutations emit a `SCHEDULE_CHANGED_EVENT` window event so overview + calendar refetch without reload.
- Agent workflow docs live under `docs/agents/`; local issue tracker under `.scratch/` (see `AGENTS.md`).
