# 01: Connect the dedicated Google Calendar

**What to build:** The admin can point the app at a dedicated "MUA — Booking" Google Calendar using a service account, verify that the share is writable, enable or disable the mirror, and see why a connection is unhealthy. Disconnecting stops all mirror activity and leaves existing events untouched. The browser never receives a Google credential. This ticket builds the connection and the human setup checklist; it mirrors no Bookings yet.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A migration declares the single-row connection record with an enabled flag, the calendar id, a last-verified timestamp, a last-error message, and an updated timestamp, readable and writable only by the authenticated role with no anonymous policy.
- [ ] Server-only environment values exist for the service-account email, service-account private key, calendar id, and cron secret, documented in the example env file without real secrets and never exposed with a `NEXT_PUBLIC_` prefix.
- [ ] The service-account private key is normalised from its escaped form before use, and a malformed or missing key produces a plain Indonesian configuration error rather than an unhandled exception.
- [ ] A cheap access check reads the configured calendar and creates then deletes a clearly-labelled probe event, so a read-only share or a missing write permission is reported as a failure.
- [ ] The admin settings area gains a Google Calendar section showing whether the app is configured, whether the mirror is enabled, the last verified time, and the last error, all in Indonesian.
- [ ] "Tes koneksi" runs the access check and reports success or the concrete failure; a successful test records the verified time and clears the stale error.
- [ ] "Hubungkan" enables the mirror only after a successful access check; "Putuskan" disables it immediately, writes nothing to Google, and does not delete any existing event.
- [ ] While the mirror is enabled but unhealthy, the dashboard shows a banner explaining that Google is not receiving updates and linking to the settings section.
- [ ] The connection functions are tested through the injected Google port with a mocked Supabase client, following the existing adapter test style: success, read-only failure, missing configuration, enable, disable, and "disable refuses further work".
- [ ] Declarative SQL tests assert the connection table, its single-row shape, the enabled default, and the admin-only RLS with no anonymous policy.
- [ ] No Booking is mirrored by this ticket; backfill and lifecycle belong to ticket 02, and a connection enabled here performs no event writes beyond the probe.

## Comments
