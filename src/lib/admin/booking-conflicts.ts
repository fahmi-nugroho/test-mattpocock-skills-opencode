import { doesOverlap } from "../availability";

export interface ConflictBooking {
  id?: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  status: "pending" | "confirmed" | "cancelled" | string;
}

export interface ConflictBlock {
  id?: string;
  date: string; // "YYYY-MM-DD"
  all_day: boolean;
  start_time?: string | null; // "HH:MM", null when all_day
  end_time?: string | null; // "HH:MM", null when all_day
}

export interface BookingCandidate {
  id?: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  status: "pending" | "confirmed" | "cancelled" | string;
}

/**
 * Overlap guard for admin saves (ticket 07). Only confirmed bookings
 * occupy a day — pending rows stay recordable while WA negotiation is
 * ongoing, cancelled rows never block — matching the public month RPC
 * (0004_seed_rpc.sql) which derives fully_booked from confirmed only.
 * Returns an Indonesian rejection message, or null when the save may
 * proceed. Adjacent ranges (aEnd === bStart) do not overlap, same as
 * the doesOverlap seam.
 */
export function findBookingConflict(
  candidate: BookingCandidate,
  bookings: readonly ConflictBooking[],
  blocks: readonly ConflictBlock[],
  fullDates: readonly string[],
): string | null {
  if (candidate.status !== "confirmed") return null;
  if (fullDates.includes(candidate.date)) {
    return "Tanggal ini ditandai penuh — hapus tanda penuh dulu untuk booking confirmed";
  }
  for (const b of blocks) {
    if (b.date !== candidate.date) continue;
    if (b.id !== undefined && candidate.id !== undefined && b.id === candidate.id) {
      continue;
    }
    if (b.all_day) {
      return "Jadwal bentrok dengan blokir sehari penuh pada tanggal ini";
    }
    if (b.start_time && b.end_time) {
      if (
        doesOverlap(
          candidate.start_time,
          candidate.end_time,
          b.start_time,
          b.end_time,
        )
      ) {
        return "Jadwal bentrok dengan blokir pada jam yang sama";
      }
    }
  }
  for (const other of bookings) {
    if (other.date !== candidate.date) continue;
    if (other.status !== "confirmed") continue;
    if (
      other.id !== undefined &&
      candidate.id !== undefined &&
      other.id === candidate.id
    ) {
      continue;
    }
    if (
      doesOverlap(
        candidate.start_time,
        candidate.end_time,
        other.start_time,
        other.end_time,
      )
    ) {
      return "Jadwal bentrok dengan booking lain yang sudah confirmed";
    }
  }
  return null;
}

/**
 * Block-side of the same guard: a new/edited block must not cover a
 * confirmed booking on its date (pending/cancelled bookings may stay —
 * they do not occupy the public calendar). Returns an Indonesian
 * rejection message, or null when the save may proceed.
 */
export function findBlockConflict(
  candidate: ConflictBlock,
  bookings: readonly ConflictBooking[],
): string | null {
  for (const b of bookings) {
    if (b.date !== candidate.date) continue;
    if (b.status !== "confirmed") continue;
    if (candidate.all_day) {
      return "Blokir bentrok dengan booking confirmed pada tanggal ini";
    }
    if (candidate.start_time && candidate.end_time) {
      if (
        doesOverlap(
          candidate.start_time,
          candidate.end_time,
          b.start_time,
          b.end_time,
        )
      ) {
        return "Blokir bentrok dengan booking confirmed pada jam yang sama";
      }
    }
  }
  return null;
}
