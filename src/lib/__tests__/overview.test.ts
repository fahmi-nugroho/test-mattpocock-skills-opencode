import { describe, expect, it } from "vitest";
import { summarizeBookings } from "../admin/overview";

// Seam 2 (pure): today/upcoming counts from booking rows.
// Catches miscounts and cancelled-leak. Misses live query/RLS.
describe("summarizeBookings", () => {
  it("counts today vs upcoming split by confirmed/pending", () => {
    expect(
      summarizeBookings(
        [
          { date: "2026-10-11", status: "confirmed" },
          { date: "2026-10-11", status: "pending" },
          { date: "2026-10-12", status: "confirmed" },
          { date: "2026-10-13", status: "pending" },
        ],
        "2026-10-11",
      ),
    ).toEqual({
      todayConfirmed: 1,
      todayPending: 1,
      upcomingConfirmed: 1,
      upcomingPending: 1,
    });
  });

  it("ignores cancelled and past bookings", () => {
    expect(
      summarizeBookings(
        [
          { date: "2026-10-10", status: "confirmed" },
          { date: "2026-10-11", status: "cancelled" },
          { date: "2026-10-12", status: "cancelled" },
        ],
        "2026-10-11",
      ),
    ).toEqual({
      todayConfirmed: 0,
      todayPending: 0,
      upcomingConfirmed: 0,
      upcomingPending: 0,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(summarizeBookings([], "2026-10-11")).toEqual({
      todayConfirmed: 0,
      todayPending: 0,
      upcomingConfirmed: 0,
      upcomingPending: 0,
    });
  });
});
