"use client";

import type { AdminTabId } from "@/lib/admin/admin-tabs";
import type { OverviewSummary } from "@/lib/admin/overview";

interface AdminOverviewPanelProps {
  summary: OverviewSummary;
  /** Submitted requests the Permintaan panel counts as needing action. */
  requestCount: number;
  onOpenTab: (tab: AdminTabId) => void;
}

interface ActionRow {
  id: string;
  title: string;
  detail: string;
  target: AdminTabId;
  cta: string;
}

/**
 * Ringkasan tab: what needs action now, then today/upcoming counts. Every
 * figure derives from rows the dashboard already loaded (overview counts and
 * the Permintaan panel's attention callback), so nothing here invents a
 * number the admin cannot trace back to a list.
 */
export function AdminOverviewPanel({
  summary,
  requestCount,
  onOpenTab,
}: AdminOverviewPanelProps) {
  const pending = summary.todayPending + summary.upcomingPending;
  const actions: ActionRow[] = [];

  if (requestCount > 0) {
    actions.push({
      id: "permintaan",
      title: `${requestCount} permintaan perlu ditindak`,
      detail: "Tinjau permintaan yang masuk, lalu jadikan booking.",
      target: "permintaan",
      cta: "Buka Permintaan",
    });
  }
  if (pending > 0) {
    const detail =
      summary.todayPending > 0 && summary.upcomingPending > 0
        ? `${summary.todayPending} hari ini, ${summary.upcomingPending} mendatang.`
        : summary.todayPending > 0
          ? "Semua untuk hari ini."
          : "Semua untuk tanggal mendatang.";
    actions.push({
      id: "booking",
      title: `${pending} booking menunggu konfirmasi`,
      detail,
      target: "booking",
      cta: "Buka Booking",
    });
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="overview-actions">
        <h3 id="overview-actions" className="text-sm font-semibold">
          Perlu tindakan
        </h3>
        <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {actions.length > 0 ? (
            actions.map((action) => (
              <li
                key={action.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    {action.detail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTab(action.target)}
                  className="shrink-0 rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold transition hover:border-neutral-400 hover:bg-neutral-100"
                >
                  {action.cta}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3.5">
              <p className="text-sm text-neutral-600">
                Tidak ada yang menunggu tindakan.
              </p>
              <button
                type="button"
                onClick={() => onOpenTab("booking")}
                className="mt-1.5 text-sm font-semibold text-gold-deep underline-offset-4 hover:underline"
              >
                Catat booking baru
              </button>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="overview-bookings">
        <h3 id="overview-bookings" className="text-sm font-semibold">
          Booking
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatCard
            title="Hari ini"
            confirmed={summary.todayConfirmed}
            pending={summary.todayPending}
          />
          <StatCard
            title="Mendatang"
            confirmed={summary.upcomingConfirmed}
            pending={summary.upcomingPending}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  confirmed,
  pending,
}: {
  title: string;
  confirmed: number;
  pending: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-2xl font-semibold tabular-nums">
          {confirmed + pending}
        </p>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-600">Terkonfirmasi</dt>
          <dd className="font-medium tabular-nums">{confirmed}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-600">Menunggu</dt>
          <dd
            className={`font-medium tabular-nums ${
              pending > 0 ? "text-amber-700" : ""
            }`}
          >
            {pending}
          </dd>
        </div>
      </dl>
    </div>
  );
}
