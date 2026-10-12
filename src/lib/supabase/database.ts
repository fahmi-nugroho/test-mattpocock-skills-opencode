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
    };
  };
}
