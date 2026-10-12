import { doesOverlap } from "./availability";
import type { DayOccupied } from "./day-schedule";

/**
 * Picker verdict for the popup time inputs (ticket 03):
 * - "hint": no selection yet (empty start or end) — show the
 *   choose-a-time hint, no error, chat action disabled.
 * - "order": end is not after start — inline order error, disabled.
 * - "overlap": the chosen range overlaps a shown occupied range under
 *   half-open semantics (touching edges allowed) — inline overlap
 *   error, disabled.
 * - "valid": non-overlapping range — date+time chat action enables.
 *
 * Zero-padded "HH:MM" strings compare chronologically, so plain string
 * comparison is enough. No duration, step, or window restriction in v1.
 */
export type PickerVerdict = "hint" | "order" | "overlap" | "valid";

export function validatePickerRange(
  start: string,
  end: string,
  occupied: readonly DayOccupied[],
): PickerVerdict {
  if (start === "" || end === "") return "hint";
  if (!(start < end)) return "order";
  for (const slot of occupied) {
    if (doesOverlap(start, end, slot.start, slot.end)) return "overlap";
  }
  return "valid";
}
