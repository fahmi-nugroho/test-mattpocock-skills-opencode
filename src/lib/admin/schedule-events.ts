/**
 * Cross-panel refresh signal (ticket 07). BookingsManager,
 * BlocksManager, and AdminCalendar each fetch once on mount with
 * independent state; after any booking/block/full-toggle mutation the
 * writer dispatches this window event so the other panels refetch
 * instead of visibly lagging the save until reload.
 */
export const SCHEDULE_CHANGED_EVENT = "mua:schedule-changed";

export function notifyScheduleChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SCHEDULE_CHANGED_EVENT));
  }
}
