import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";
import type { OverviewBooking } from "../admin/overview";

type TypedClient = SupabaseClient<Database>;

/**
 * Admin overview read (ticket 05): booking date+status rows from today
 * onward for the today/upcoming summary. Raw bookings stay anon-denied;
 * call with an authenticated browser client. No explicit limit: counts
 * must cover all future rows (Supabase's own default still bounds the
 * response, but the dashboard never silently truncates its own query).
 */
export async function getOverviewBookings(
  client: TypedClient,
  todayKey: string,
): Promise<OverviewBooking[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        gte(
          c: string,
          v: string,
        ): {
          order(
            c: string,
            o: { ascending: boolean },
          ): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("bookings")
    .select("date,status")
    .gte("date", todayKey)
    .order("date", { ascending: true });
  if (error) throw new Error(`Failed to load overview: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as OverviewBooking[];
}
