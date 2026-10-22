/**
 * The Google Calendar boundary (ticket 01).
 *
 * Everything behind this port is Google's REST API; tests replace it with a
 * fake so the connection, drain, and reconcile logic can run without network
 * or credentials. Ticket 01 uses the read/create/delete trio for the cheap
 * access probe; later mirror tickets extend the same seam.
 */
export interface GoogleCalendarEventDraft {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  status?: "confirmed";
  transparency?: "opaque";
}

export interface GoogleCalendarPort {
  readCalendar(calendarId: string): Promise<void>;
  createEvent(
    calendarId: string,
    event: GoogleCalendarEventDraft,
  ): Promise<{ id: string }>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}
