import type { GoogleCalendarConnection } from "../supabase/database";

/**
 * Browser-safe view of the Google Calendar connection (ticket 01). The server
 * route sends only this shape: no credential, private key, or service-account
 * email ever crosses to the client.
 */
export interface GoogleCalendarStatus {
  configured: boolean;
  configError: string | null;
  connection: GoogleCalendarConnection;
}

/** Mirrors are unhealthy only while enabled and carrying a failure. */
export function isMirrorUnhealthy(
  connection: Pick<GoogleCalendarConnection, "enabled" | "last_error">,
): boolean {
  return connection.enabled && connection.last_error !== "";
}

/** Null/not-yet-loaded status never raises the dashboard banner. */
export function isMirrorStatusUnhealthy(
  status: GoogleCalendarStatus | null,
): boolean {
  return (
    status !== null &&
    status.connection.enabled &&
    (!status.configured || isMirrorUnhealthy(status.connection))
  );
}
