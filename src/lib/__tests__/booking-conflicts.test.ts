import { describe, expect, it } from "vitest";
import {
  findBlockConflict,
  findBookingConflict,
} from "../admin/booking-conflicts";

// Seam 1 (pure): overlap guard over doesOverlap with known-good literals.
// Catches double-booking (confirmed vs confirmed/blocks/full_dates).
// Misses live DB state (adapters fetch siblings before calling).
describe("findBookingConflict", () => {
  it("returns null when nothing occupies the day", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
        [],
        [],
        [],
      ),
    ).toBeNull();
  });

  it("returns null for pending candidates so WA negotiation stays recordable", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "pending",
        },
        [
          {
            date: "2026-10-12",
            start_time: "09:30",
            end_time: "10:30",
            status: "confirmed",
          },
        ],
        [],
        [],
      ),
    ).toBeNull();
  });

  it("rejects a confirmed booking overlapping another confirmed booking", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "10:00",
          end_time: "12:00",
          status: "confirmed",
        },
        [
          {
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "11:00",
            status: "confirmed",
          },
        ],
        [],
        [],
      ),
    ).toMatch(/bentrok/i);
  });

  it("ignores pending siblings and self id so reschedules do not self-conflict", () => {
    expect(
      findBookingConflict(
        {
          id: "b1",
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
        [
          {
            id: "b1",
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
          {
            id: "b2",
            date: "2026-10-12",
            start_time: "09:30",
            end_time: "09:45",
            status: "pending",
          },
        ],
        [],
        [],
      ),
    ).toBeNull();
  });

  it("allows adjacent bookings (touching edges do not overlap)", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "10:00",
          end_time: "11:00",
          status: "confirmed",
        },
        [
          {
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
        [],
        [],
      ),
    ).toBeNull();
  });

  it("rejects a confirmed booking inside an all-day block", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
        [],
        [{ date: "2026-10-12", all_day: true }],
        [],
      ),
    ).toMatch(/bentrok|tutup|blok/i);
  });

  it("rejects a confirmed booking overlapping a time-range block", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "12:30",
          end_time: "13:30",
          status: "confirmed",
        },
        [],
        [
          {
            date: "2026-10-12",
            all_day: false,
            start_time: "12:00",
            end_time: "14:00",
          },
        ],
        [],
      ),
    ).toMatch(/bentrok/i);
  });

  it("rejects a confirmed booking on a manual full-toggle date", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
        [],
        [],
        ["2026-10-12"],
      ),
    ).toMatch(/penuh/i);
  });

  it("ignores other dates so the guard stays day-scoped", () => {
    expect(
      findBookingConflict(
        {
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
        [
          {
            date: "2026-10-13",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
        [
          {
            date: "2026-10-13",
            all_day: true,
          },
        ],
        ["2026-10-13"],
      ),
    ).toBeNull();
  });
});

describe("findBlockConflict", () => {
  it("returns null when no confirmed booking shares the date", () => {
    expect(
      findBlockConflict(
        { date: "2026-10-12", all_day: true },
        [
          {
            date: "2026-10-13",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
      ),
    ).toBeNull();
  });

  it("rejects an all-day block over a confirmed booking", () => {
    expect(
      findBlockConflict(
        { date: "2026-10-12", all_day: true },
        [
          {
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
      ),
    ).toMatch(/bentrok/i);
  });

  it("rejects a time-range block overlapping a confirmed booking", () => {
    expect(
      findBlockConflict(
        {
          date: "2026-10-12",
          all_day: false,
          start_time: "09:30",
          end_time: "10:30",
        },
        [
          {
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
      ),
    ).toMatch(/bentrok/i);
  });

  it("allows a block next to a confirmed booking", () => {
    expect(
      findBlockConflict(
        {
          date: "2026-10-12",
          all_day: false,
          start_time: "10:00",
          end_time: "11:00",
        },
        [
          {
            date: "2026-10-12",
            start_time: "09:00",
            end_time: "10:00",
            status: "confirmed",
          },
        ],
      ),
    ).toBeNull();
  });
});
