import { describe, expect, it } from "vitest";
import {
  BOOKING_FILTERS,
  BOOKING_FILTER_LABEL,
  BOOKING_STATUS_LABEL,
  filterBookings,
} from "../admin/booking-filter";
import { filterByQuery } from "../admin/filter-items";
import {
  LIST_PAGE_SIZE,
  splitByToday,
  windowRows,
} from "../admin/list-window";
import type { BookingStatus } from "../supabase/database";

// Seam (pure): the Booking dialog's status chips. Catches a drifted chip
// label, a chip that narrows the wrong status, and a filtered list whose
// search, date split, or page size is applied before the filter. Misses the
// chip wiring and the roving-tablist keyboard handling (manual QA).
describe("filterBookings", () => {
  const TODAY = "2026-10-19";
  const row = (
    id: string,
    status: BookingStatus,
    fields: Partial<{
      client_name: string;
      date: string;
      start_time: string;
    }> = {},
  ) => ({
    id,
    status,
    client_name: "Sari",
    date: "2026-10-20",
    start_time: "09:00",
    end_time: "10:00",
    ...fields,
  });

  const PENDING = row("pending", "pending");
  const CONFIRMED = row("confirmed", "confirmed");
  const CANCELLED = row("cancelled", "cancelled");
  const ALL = [PENDING, CONFIRMED, CANCELLED];

  it("names the ordered filter vocabulary all, pending, confirmed, cancelled", () => {
    expect(BOOKING_FILTERS).toEqual([
      "all",
      "pending",
      "confirmed",
      "cancelled",
    ]);
  });

  it("labels the chips from the row labels, so a chip cannot drift from a row", () => {
    expect(BOOKING_STATUS_LABEL).toEqual({
      pending: "Menunggu",
      confirmed: "Terkonfirmasi",
      cancelled: "Dibatalkan",
    });
    expect(BOOKING_FILTER_LABEL).toEqual({
      all: "Semua",
      pending: BOOKING_STATUS_LABEL.pending,
      confirmed: BOOKING_STATUS_LABEL.confirmed,
      cancelled: BOOKING_STATUS_LABEL.cancelled,
    });
    expect(BOOKING_FILTER_LABEL.pending).toBe("Menunggu");
    expect(BOOKING_FILTER_LABEL.confirmed).toBe("Terkonfirmasi");
    expect(BOOKING_FILTER_LABEL.cancelled).toBe("Dibatalkan");
  });

  it("returns every booking for the show-everything chip", () => {
    expect(filterBookings(ALL, "all")).toEqual(ALL);
  });

  it("narrows to each status the chip names", () => {
    expect(filterBookings(ALL, "pending")).toEqual([PENDING]);
    expect(filterBookings(ALL, "confirmed")).toEqual([CONFIRMED]);
    expect(filterBookings(ALL, "cancelled")).toEqual([CANCELLED]);
  });

  it("returns [] when no booking has the chosen status", () => {
    expect(filterBookings([PENDING, CONFIRMED], "cancelled")).toEqual([]);
    expect(filterBookings([], "all")).toEqual([]);
  });

  it("composes with the search so a booking must match both", () => {
    const rows = [
      row("confirmed-sari", "confirmed", { client_name: "Sari" }),
      row("pending-sari", "pending", { client_name: "Sari" }),
      row("confirmed-dewi", "confirmed", { client_name: "Dewi" }),
    ];
    const pick = (item: (typeof rows)[number]) => [item.client_name];
    const narrowed = filterByQuery(
      filterBookings(rows, "confirmed"),
      "sari",
      pick,
    );
    expect(narrowed.map((item) => item.id)).toEqual(["confirmed-sari"]);
  });

  it("splits the filtered rows, so a cancelled future booking stays Mendatang", () => {
    const rows = [
      row("future-cancelled", "cancelled", { date: "2026-11-01" }),
      row("past-cancelled", "cancelled", { date: "2026-10-01" }),
      row("future-confirmed", "confirmed", { date: "2026-11-02" }),
    ];
    const { upcoming, history } = splitByToday(
      filterBookings(rows, "cancelled"),
      TODAY,
    );
    expect(upcoming.map((item) => item.id)).toEqual(["future-cancelled"]);
    expect(history.map((item) => item.id)).toEqual(["past-cancelled"]);
  });

  it("pages each filtered group at the shared page size", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row(`cancelled-${index}`, "cancelled", {
        date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    const { upcoming } = splitByToday(
      filterBookings(rows, "cancelled"),
      TODAY,
    );
    expect(windowRows(upcoming, LIST_PAGE_SIZE)).toEqual({
      visible: upcoming.slice(0, LIST_PAGE_SIZE),
      hidden: 2,
    });
  });
});
