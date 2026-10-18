/**
 * Shared requested-slot validation for Booking Requests (review fix 1).
 *
 * The requested slot is per-field optional: the spec's "Schema changes" make
 * `date`, `start_time`, and `end_time` each nullable, and the admin behaviour
 * makes each optional. A present value must be well-formed, and
 * `start_time < end_time` only matters when both times are present.
 * "" / null / undefined are absent. Messages are Indonesian and name the
 * field, matching the public submit validator and the SQL submit function.
 */

export interface RequestSlotInput {
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface ValidatedRequestSlot {
  date: string | null;
  start_time: string | null;
  end_time: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** "" / null / undefined are absent; otherwise the trimmed value. */
function present(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Validate a requested slot per field. Each of date/start/end may be absent
 * independently; a present date must be `YYYY-MM-DD`, a present time strict
 * `HH:MM` (00:00–23:59), and start must precede end only when both are given.
 */
export function validateRequestSlot(
  input: RequestSlotInput,
): ValidatedRequestSlot {
  const date = present(input.date);
  const start_time = present(input.start_time);
  const end_time = present(input.end_time);

  if (date !== null && !DATE_RE.test(date)) {
    throw new Error("Tanggal permintaan harus format YYYY-MM-DD");
  }
  if (start_time !== null && !HHMM_RE.test(start_time)) {
    throw new Error("Jam permintaan harus format HH:MM (00:00–23:59)");
  }
  if (end_time !== null && !HHMM_RE.test(end_time)) {
    throw new Error("Jam permintaan harus format HH:MM (00:00–23:59)");
  }
  if (start_time !== null && end_time !== null && !(start_time < end_time)) {
    throw new Error("Jam mulai harus sebelum jam selesai");
  }

  return { date, start_time, end_time };
}
