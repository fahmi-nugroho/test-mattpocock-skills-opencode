/**
 * The result shape shared by the server reconcile adapter and the admin
 * settings UI. Counts only: no client data or credentials cross this boundary.
 */
export interface MirrorReconcileSummary {
  ok: boolean;
  /** True when the master switch is off; nothing was read from Google. */
  disabled: boolean;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
  error: string | null;
}
