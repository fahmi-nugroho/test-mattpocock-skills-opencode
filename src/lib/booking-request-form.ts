/**
 * Pure form helpers for the public Format Booking page (booking-request-intake
 * ticket 03).
 *
 * The page holds its fields as strings (the shape HTML inputs give back) and
 * decides its clash warning from the public day schedule read. Both are pure
 * decisions with no React or Supabase in them, so they live here and are
 * tested at the seam; the page only renders their result.
 */

import type { BookingRequestContext } from "./booking-request";
import type { DaySchedule } from "./day-schedule";
import { validatePickerRange } from "./time-picker";

/** Raw form field values, all kept as strings for controlled inputs. */
export interface BookingRequestFormFields {
  client_name: string;
  client_phone: string;
  event_type: string;
  headcount: string; // kept as text so a number input stays controlled
  venue: string;
  hairdo: string;
  notes: string;
  date: string; // "YYYY-MM-DD", "" when not chosen
  start_time: string; // "HH:MM", "" when not chosen
  end_time: string;
}

/** Empty form with the headcount defaulted to one person. */
export const EMPTY_REQUEST_FORM: BookingRequestFormFields = {
  client_name: "",
  client_phone: "",
  event_type: "",
  headcount: "1",
  venue: "",
  hairdo: "",
  notes: "",
  date: "",
  start_time: "",
  end_time: "",
};

/**
 * Start the form from the link's read context: only the admin-supplied
 * client_name and requested date/start/end are prefilled when present; every
 * other field starts empty and the headcount defaults to one. The client can
 * still edit every field afterwards.
 */
export function formFieldsFromContext(
  context: BookingRequestContext,
): BookingRequestFormFields {
  return {
    ...EMPTY_REQUEST_FORM,
    client_name: context.client_name ?? "",
    date: context.date ?? "",
    start_time: context.start_time ?? "",
    end_time: context.end_time ?? "",
  };
}

/**
 * Clash verdict for the chosen slot against the public day schedule:
 * - "none": no complete slot yet, or the slot is free (or uncheckable).
 * - "order": the end is not after the start — an inline error, not a warning.
 * - "blocked": the day is an all-day closure — a warning that never blocks.
 * - "overlap": the slot crosses an occupied range under the calendar popup's
 *   half-open rule — a warning that never blocks.
 *
 * A missing schedule (the day-schedule read failed) degrades to "none" so a
 * transient read failure can never manufacture a false conflict.
 */
export type ClashVerdict = "none" | "order" | "blocked" | "overlap";

export function evaluateClash(
  date: string,
  start: string,
  end: string,
  schedule: DaySchedule | null,
): ClashVerdict {
  if (date === "" || start === "" || end === "") return "none";
  if (!(start < end)) return "order";
  if (schedule === null) return "none";
  if (schedule.allDayBlocked || schedule.status === "blocked") return "blocked";
  return validatePickerRange(start, end, schedule.occupied) === "overlap"
    ? "overlap"
    : "none";
}
