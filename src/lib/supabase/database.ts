/**
 * Ticket 02 typed helpers: Database row types mirroring supabase/migrations.
 *
 * Time columns stay date + "HH:MM" text (see 0001_schema.sql header), so
 * Booking/Block rows share field names and semantics with the
 * BookingForDay/BlockForDay seam in src/lib/availability.ts. Nullable
 * variants (service unlinked, all-day blocks) use `string | null`;
 * narrow to the seam shape after null checks at the call site.
 */

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface Service {
  id: string;
  name: string;
  description: string;
  price_idr: number;
  duration_min: number;
  active: boolean;
  cover_image_url: string | null;
  sort: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  image_url: string;
  sort: number;
  visible: boolean;
}

export interface Booking {
  id: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  service_id: string | null;
  client_name: string;
  client_phone: string;
  notes: string;
  status: BookingStatus;
  event_type: string; // "" when none (0015)
  headcount: number; // >= 1 (0015)
  venue: string; // "" when none (0015)
  hairdo: string; // Style: "hijabdo" | "hairdo" | "" when unknown (0015, narrowed by 0017)
  reference: string; // "" when none; <= 300 chars (0017)
  total_price: number | null; // null = not quoted yet (0015)
  dp_amount: number; // >= 0, default 0 (0015)
}

/**
 * A client submission from a Format Booking link (see 0015 migration). The
 * reserved slot (date/start_time/end_time) is nullable because the admin may
 * generate the link before anything is agreed; accepted_booking_id is null
 * until the admin accepts the request into a Booking.
 */
export interface BookingRequest {
  id: string;
  token: string; // DB-generated 128-bit hex, distinct from id
  created_at: string;
  expires_at: string;
  submitted_at: string | null;
  accepted_booking_id: string | null;
  client_name: string;
  client_phone: string;
  event_type: string;
  headcount: number; // >= 1
  venue: string;
  hairdo: string; // Style: "hijabdo" | "hairdo" | "" when unknown
  reference: string; // "" when none; <= 300 chars
  notes: string;
  date: string | null; // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM"
  end_time: string | null; // "HH:MM"
}

/**
 * A frozen invoice snapshot (0018). Every snapshot column is copied from the
 * Booking when the Invoice is issued, so later Booking edits never change a
 * saved Invoice. Only `sent_at` and — while unsent — the two dates may move.
 */
export interface Invoice {
  id: string;
  created_at: string;
  booking_id: string;
  year: number;
  seq: number;
  number: string;
  issued_on: string; // "YYYY-MM-DD"
  due_on: string; // "YYYY-MM-DD"
  sent_at: string | null;
  client_name: string;
  client_phone: string;
  service_name: string;
  event_type: string;
  headcount: number;
  venue: string;
  hairdo: string;
  booking_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  subtotal: number;
  dp_amount: number;
}

export interface Block {
  id: string;
  date: string; // "YYYY-MM-DD"
  all_day: boolean;
  start_time: string | null; // "HH:MM", null when all_day
  end_time: string | null; // "HH:MM", null when all_day
  reason: string;
}

export interface Settings {
  id: number; // always 1 (single-row table)
  wa_number: string;
  full_dates: string[]; // "YYYY-MM-DD" manual full-toggle dates
  headline: string; // max 120 chars (see 0013 migration)
  subcopy: string; // max 300 chars (see 0013 migration)
  portrait_url: string | null; // admin portrait, null falls back to portfolio cover
  bank_name: string; // "" when not configured; invoice prints an em dash (0018)
  account_name: string; // "" when not configured (0018)
  account_number: string; // "" when not configured (0018)
  instagram_handle: string; // "" when not configured (0018)
}

export interface TestimonialRow {
  id: string;
  quote: string; // 1-300 chars
  client_name: string;
  sort: number;
  visible: boolean;
}

export interface ProfileStatRow {
  id: string;
  value: string; // 1-40 chars
  label: string; // 1-40 chars
  sort: number;
  visible: boolean;
}

/**
 * The single-row Calendar Mirror connection (0020). `enabled` is the master
 * switch; `last_error` is the latest concrete failure and is pinned to '' when
 * the connection is healthy. Google credentials never live in this row.
 */
export interface GoogleCalendarConnection {
  id: number; // always 1 (single-row table)
  enabled: boolean;
  calendar_id: string;
  last_verified_at: string | null; // ISO timestamp
  last_error: string; // "" when healthy
  updated_at: string; // ISO timestamp
}

export interface MonthAvailabilityRow {
  date: string; // "YYYY-MM-DD"
  status: "available" | "fully_booked" | "blocked";
}

export interface DayScheduleRow {
  date: string; // "YYYY-MM-DD"
  status: "available" | "fully_booked" | "blocked";
  all_day_blocked: boolean;
  occupied: unknown[];
  free: unknown[];
}

interface Table<T> {
  Row: T;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
}

/** Minimal supabase-js Database shape for typed clients. */
export interface Database {
  public: {
    Tables: {
      services: Table<Service>;
      portfolio_items: Table<PortfolioItem>;
      bookings: Table<Booking>;
      blocks: Table<Block>;
      settings: Table<Settings>;
      testimonials: Table<TestimonialRow>;
      profile_stats: Table<ProfileStatRow>;
      booking_requests: Table<BookingRequest>;
      invoices: Table<Invoice>;
      google_calendar_connection: Table<GoogleCalendarConnection>;
    };
    Functions: {
      get_month_availability: {
        Args: { p_year: number; p_month: number };
        Returns: MonthAvailabilityRow[];
      };
      get_day_schedule: {
        Args: { p_date: string };
        Returns: DayScheduleRow;
      };
      get_public_wa_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_public_profile: {
        Args: Record<string, never>;
        Returns: {
          headline: string;
          subcopy: string;
          portrait_url: string | null;
        };
      };
      get_booking_request: {
        Args: { p_token: string };
        Returns: unknown;
      };
      submit_booking_request: {
        Args: { p_token: string; p_payload: Record<string, unknown> };
        Returns: unknown;
      };
      create_invoice: {
        Args: {
          p_booking_id: string;
          p_issued_on: string;
          p_due_on: string;
        };
        Returns: Invoice;
      };
    };
  };
}
