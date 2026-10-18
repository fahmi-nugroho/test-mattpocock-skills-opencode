import { describe, expect, it } from "vitest";
import type { BookingRequestContext } from "../booking-request";
import {
  EMPTY_REQUEST_FORM,
  evaluateClash,
  formFieldsFromContext,
} from "../booking-request-form";
import type { DaySchedule } from "../day-schedule";

// Seam 1 (pure): read context -> form fields. The admin's link prefills only
// the name and the agreed slot; every other field starts empty and the
// headcount defaults to one so the client always has a valid starting form.
describe("formFieldsFromContext", () => {
  it("prefills the admin-supplied name and slot, leaving the rest empty", () => {
    const context: BookingRequestContext = {
      state: "open",
      client_name: "Sari",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    };
    expect(formFieldsFromContext(context)).toEqual({
      client_name: "Sari",
      client_phone: "",
      event_type: "",
      headcount: "1",
      venue: "",
      hairdo: "",
      reference: "",
      notes: "",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    });
  });

  it("starts fully empty (headcount one) when the link set nothing", () => {
    const context: BookingRequestContext = {
      state: "open",
      client_name: null,
      date: null,
      start_time: null,
      end_time: null,
    };
    expect(formFieldsFromContext(context)).toEqual(EMPTY_REQUEST_FORM);
    expect(EMPTY_REQUEST_FORM.headcount).toBe("1");
    expect(EMPTY_REQUEST_FORM.reference).toBe("");
    expect(EMPTY_REQUEST_FORM.hairdo).toBe("");
  });
});

function schedule(overrides: Partial<DaySchedule> = {}): DaySchedule {
  return {
    date: "2026-11-01",
    status: "available",
    allDayBlocked: false,
    occupied: [],
    free: [],
    ...overrides,
  };
}

// Seam 1 (pure): chosen slot + public day schedule -> clash verdict. Reuses
// the calendar popup's half-open overlap rule (via validatePickerRange) and
// never returns a verdict that could be read as "blocked".
describe("evaluateClash", () => {
  it("returns none until date, start, and end are all chosen", () => {
    expect(evaluateClash("", "09:00", "12:00", schedule())).toBe("none");
    expect(evaluateClash("2026-11-01", "", "12:00", schedule())).toBe("none");
    expect(evaluateClash("2026-11-01", "09:00", "", schedule())).toBe("none");
  });

  it("returns order when the end is not after the start", () => {
    expect(evaluateClash("2026-11-01", "12:00", "09:00", schedule())).toBe(
      "order",
    );
    expect(evaluateClash("2026-11-01", "09:00", "09:00", schedule())).toBe(
      "order",
    );
  });

  it("returns none for a valid slot when the schedule could not be fetched", () => {
    expect(evaluateClash("2026-11-01", "09:00", "12:00", null)).toBe("none");
  });

  it("returns blocked for an all-day closure by status", () => {
    expect(
      evaluateClash(
        "2026-11-01",
        "09:00",
        "12:00",
        schedule({ status: "blocked" }),
      ),
    ).toBe("blocked");
  });

  it("returns blocked when the day is flagged all-day blocked", () => {
    expect(
      evaluateClash(
        "2026-11-01",
        "09:00",
        "12:00",
        schedule({ allDayBlocked: true }),
      ),
    ).toBe("blocked");
  });

  it("returns overlap when the slot crosses an occupied range", () => {
    expect(
      evaluateClash(
        "2026-11-01",
        "09:00",
        "12:00",
        schedule({
          occupied: [{ start: "11:00", end: "13:00", kind: "booked" }],
        }),
      ),
    ).toBe("overlap");
  });

  it("returns none when the slot only touches an occupied range (half-open)", () => {
    expect(
      evaluateClash(
        "2026-11-01",
        "09:00",
        "11:00",
        schedule({
          occupied: [{ start: "11:00", end: "13:00", kind: "booked" }],
        }),
      ),
    ).toBe("none");
  });

  it("returns order before blocked when the range is also backwards", () => {
    expect(
      evaluateClash(
        "2026-11-01",
        "12:00",
        "09:00",
        schedule({ status: "blocked" }),
      ),
    ).toBe("order");
  });
});
