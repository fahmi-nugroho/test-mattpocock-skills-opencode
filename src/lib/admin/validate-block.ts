export interface BlockInput {
  date: string;
  all_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string;
}

export interface ValidatedBlockInput {
  date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Validate the admin block form (ticket 07). Mirrors the SQL CHECK
 * (0001_schema.sql: all_day=true forces NULL times, otherwise a valid
 * HH:MM range with start < end) so bad rows are rejected before a DB
 * write; defaults a missing reason to "" (same shape as blocks).
 */
export function validateBlockInput(input: BlockInput): ValidatedBlockInput {
  if (!DATE_RE.test(input.date)) {
    throw new Error("Tanggal blokir harus format YYYY-MM-DD");
  }
  if (input.all_day) {
    if (input.start_time != null || input.end_time != null) {
      throw new Error(
        "Blokir sehari penuh tidak boleh punya jam mulai/selesai",
      );
    }
    return {
      date: input.date,
      all_day: true,
      start_time: null,
      end_time: null,
      reason: (input.reason ?? "").trim(),
    };
  }
  if (input.start_time == null || input.end_time == null) {
    throw new Error("Blokir rentang waktu wajib punya jam mulai dan selesai");
  }
  if (!HHMM_RE.test(input.start_time) || !HHMM_RE.test(input.end_time)) {
    throw new Error("Jam blokir harus format HH:MM (00:00–23:59)");
  }
  if (!(input.start_time < input.end_time)) {
    throw new Error("Jam mulai harus sebelum jam selesai");
  }
  return {
    date: input.date,
    all_day: false,
    start_time: input.start_time,
    end_time: input.end_time,
    reason: (input.reason ?? "").trim(),
  };
}
