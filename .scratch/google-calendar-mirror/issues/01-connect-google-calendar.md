# 01: Connect the dedicated Google Calendar

**What to build:** The admin can point the app at a dedicated "MUA — Booking" Google Calendar using a service account, verify that the share is writable, enable or disable the mirror, and see why a connection is unhealthy. Disconnecting stops all mirror activity and leaves existing events untouched. The browser never receives a Google credential. This ticket builds the connection and the human setup checklist; it mirrors no Bookings yet.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A migration declares the single-row connection record with an enabled flag, the calendar id, a last-verified timestamp, a last-error message, and an updated timestamp, readable and writable only by the authenticated role with no anonymous policy.
- [x] Server-only environment values exist for the service-account email, service-account private key, calendar id, and cron secret, documented in the example env file without real secrets and never exposed with a `NEXT_PUBLIC_` prefix.
- [x] The service-account private key is normalised from its escaped form before use, and a malformed or missing key produces a plain Indonesian configuration error rather than an unhandled exception.
- [x] A cheap access check reads the configured calendar and creates then deletes a clearly-labelled probe event, so a read-only share or a missing write permission is reported as a failure.
- [x] The admin settings area gains a Google Calendar section showing whether the app is configured, whether the mirror is enabled, the last verified time, and the last error, all in Indonesian.
- [x] "Tes koneksi" runs the access check and reports success or the concrete failure; a successful test records the verified time and clears the stale error.
- [x] "Hubungkan" enables the mirror only after a successful access check; "Putuskan" disables it immediately, writes nothing to Google, and does not delete any existing event.
- [x] While the mirror is enabled but unhealthy, the dashboard shows a banner explaining that Google is not receiving updates and linking to the settings section.
- [x] The connection functions are tested through the injected Google port with a mocked Supabase client, following the existing adapter test style: success, read-only failure, missing configuration, enable, disable, and "disable refuses further work".
- [x] Declarative SQL tests assert the connection table, its single-row shape, the enabled default, and the admin-only RLS with no anonymous policy.
- [x] No Booking is mirrored by this ticket; backfill and lifecycle belong to ticket 02, and a connection enabled here performs no event writes beyond the probe.

## Comments

- 2026-10-22 — Resolved.
  - Added `supabase/migrations/0020_google_calendar_connection.sql`: the single-row `google_calendar_connection` (enabled, calendar id, last verified, last error, updated_at), an update trigger, admin-only RLS with no anon policy, and a seeded `id = 1` row.
  - Added `src/lib/google/config.ts`: server-only service-account email/key/calendar-id loading, escaped-`\n` normalisation, and plain Indonesian errors for missing or malformed credentials.
  - Added `src/lib/google/port.ts` and `calendar-api.ts`: the injected Google boundary plus the real service-account REST client (JWT → short-lived token, read/create/delete). The probe reads the calendar, creates a labelled event, then deletes it; a failed cleanup is reported with a manual-removal hint.
  - Added `src/lib/google/calendar-connection.ts`: test, connect (enable only after a successful probe), disconnect (no Google call), the enabled guard, and the unhealthy derivation.
  - Added the authenticated Node route `src/app/api/admin/google-calendar/route.ts` (GET status; POST test/connect/disconnect) using the admin's Supabase bearer token, plus the Indonesian settings section and the dashboard unhealthy banner.
  - Documented the four server-only values in `.env.example` and `docs/google-calendar-setup.md`, including the one-time Google Cloud/calendar-share checklist.
  - Tests: new config, connection-adapter, and declarative SQL suites. `npm run typecheck` clean; full `vitest run` 611 passed; `npm run build` green.
  - Code review fixes: the banner now also treats enabled-but-unconfigured as unhealthy; failed probe cleanup is reported; README counts/structure refreshed; UI copy avoids "sinkronisasi". Ticket 02/03 work (Booking projection, queue, reconcile, cron) deliberately untouched.

