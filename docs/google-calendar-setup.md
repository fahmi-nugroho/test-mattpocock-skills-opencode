# Google Calendar setup (Calendar Mirror)

The app mirrors **confirmed Bookings only** into one dedicated secondary Google
Calendar. Google is never a source of truth: editing or deleting a mirrored
event in Google does not change a Booking, and Blocks, full dates, Booking
Requests, and Invoices never appear there. See
[ADR-0004](adr/0004-google-calendar-is-a-one-way-booking-mirror.md).

This is one-time human console work. The app can test the share but cannot
create it for you.

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) with the
   owner's Google account.
2. Create (or choose) a project for the mirror.
3. Enable **Google Calendar API** under *APIs & Services → Library*.

## 2. Service account

1. Go to *APIs & Services → Credentials → Create credentials → Service account*.
2. Create the account, then open it → *Keys → Add key → Create new key → JSON*.
3. Download the JSON once. It contains the service-account email
   (`client_email`) and private key.
4. Copy those two values into the server environment:

   | Env value | From the JSON |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` |
   | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` (escaped `\n` is fine) |

## 3. Dedicated calendar

1. In Google Calendar, create a secondary calendar named **MUA — Booking**.
2. Open its *Settings and sharing*.
3. Under *Share with specific people or groups*, add the service-account email.
4. Grant **Make changes to events**. Read-only access is deliberately rejected
   by **Tes koneksi** because the mirror must write.
5. Copy the calendar id (usually ends in `@group.calendar.google.com`) into
   `GOOGLE_CALENDAR_ID`.

## 4. Cron secret and deploy

1. Set `GOOGLE_CALENDAR_CRON_SECRET` to a long random value.
2. Set all four values as **server-only** environment values on the host. Never
   prefix them with `NEXT_PUBLIC_`, never commit them, and never expose them to
   the browser.
3. Deploy, then sign in to `/admin` → **Pengaturan → Google Calendar**.
4. Press **Tes koneksi**: it reads the calendar, creates a clearly labelled
   probe event, and deletes it. A read-only share or missing write permission
   is reported as a failure.
5. Press **Hubungkan** to enable the mirror; the first successful drain
   immediately backfills confirmed Bookings dated today or later in WIB.
   **Putuskan** disables it immediately and leaves existing Google events
   untouched.

Rotating credentials means replacing the environment values and redeploying;
there is no OAuth consent screen, refresh token, or testing-mode expiry.

## Environment summary

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | yes | Robot identity the calendar is shared with |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | yes | Signs the short-lived Google access token; escaped `\n` is normalised |
| `GOOGLE_CALENDAR_ID` | yes | The dedicated **MUA — Booking** calendar |
| `GOOGLE_CALENDAR_CRON_SECRET` | yes (cron) | Authenticates the daily reconcile route (ticket 03) |

Malformed or missing values produce a plain Indonesian configuration message in
the admin Google Calendar section, not a raw server exception.
