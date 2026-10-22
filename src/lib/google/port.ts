/**
 * The Google Calendar boundary.
 *
 * Everything behind this port is Google's REST API; tests replace it with a
 * fake so the connection, drain, and reconcile logic can run without network
 * or credentials. Ticket 01 used the read/create/delete trio for the cheap
 * access probe; ticket 02 extends the same seam with update and a list of
 * events this app owns.
 */
export interface GoogleCalendarEventDraft {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  status?: "confirmed";
  transparency?: "opaque";
  /**
   * Private marker used to recognise events this app created, even after a
   * failed tracked-row write. Google never shows these to event guests.
   */
  extendedProperties?: { private?: Record<string, string> };
}

export interface GoogleCalendarEventRef {
  id: string;
}

export interface GoogleCalendarPort {
  readCalendar(calendarId: string): Promise<void>;
  createEvent(
    calendarId: string,
    event: GoogleCalendarEventDraft,
  ): Promise<{ id: string }>;
  updateEvent(
    calendarId: string,
    eventId: string,
    event: GoogleCalendarEventDraft,
  ): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  /** Events carrying this Booking's private marker, so a retry can adopt one. */
  listOwnedEvents(
    calendarId: string,
    bookingId: string,
  ): Promise<GoogleCalendarEventRef[]>;
}
