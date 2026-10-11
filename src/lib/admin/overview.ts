import type { BookingStatus } from "../supabase/database";

export interface OverviewBooking {
  date: string; // "YYYY-MM-DD"
  status: BookingStatus;
}

export interface OverviewSummary {
  todayConfirmed: number;
  todayPending: number;
  upcomingConfirmed: number;
  upcomingPending: number;
}

/**
 * Summarise admin overview counts (ticket 05): today vs upcoming,
 * split by confirmed/pending. Cancelled and past rows are ignored so
 * the dashboard shows actionable work only. Date strings are
 * "YYYY-MM-DD", so lexicographic comparison matches chronology.
 */
export function summarizeBookings(
  bookings: readonly OverviewBooking[],
  todayKey: string,
): OverviewSummary {
  let todayConfirmed = 0;
  let todayPending = 0;
  let upcomingConfirmed = 0;
  let upcomingPending = 0;
  for (const b of bookings) {
    if (b.status !== "confirmed" && b.status !== "pending") continue;
    if (b.date === todayKey) {
      if (b.status === "confirmed") todayConfirmed += 1;
      else todayPending += 1;
    } else if (b.date > todayKey) {
      if (b.status === "confirmed") upcomingConfirmed += 1;
      else upcomingPending += 1;
    }
  }
  return { todayConfirmed, todayPending, upcomingConfirmed, upcomingPending };
}
