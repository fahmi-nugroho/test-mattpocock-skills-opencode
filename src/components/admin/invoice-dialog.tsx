"use client";

import { useEffect, useState, type RefObject } from "react";
import { Dialog } from "@/components/dialog";
import { getTodayKey } from "@/lib/calendar";
import {
  invoiceIsSent,
  invoiceIssueRefusal,
  invoiceSentLabel,
  paymentPosition,
} from "@/lib/admin/invoice";
import { formatIDR } from "@/lib/format";
import { createInvoice } from "@/lib/supabase/admin-invoices";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Booking, Invoice } from "@/lib/supabase/database";

interface InvoiceDialogProps {
  /** The Booking whose Invoices are shown; null while the dialog is closed. */
  booking: Booking | null;
  /** The Booking's service name, or "" when the service is gone (as 0018 stores it). */
  serviceName: string;
  /** Every loaded Invoice for this Booking, newest first. */
  invoices: readonly Invoice[];
  /** The new Invoice, so the manager's row summary updates without a reload. */
  onCreated: (invoice: Invoice) => void;
  onClose: () => void;
  returnFocusTo: RefObject<HTMLElement | null>;
  /**
   * The manager owns the hand-off back to the booking list and the focus that
   * lands there, so this dialog never pulls focus to the closed list's trigger.
   */
  restoreFocus?: boolean;
}

/**
 * One Booking's invoices (invoice-and-booking-filter ticket 02): issue a new
 * Invoice in one action, or see every Invoice already issued, newest first.
 *
 * Creation defaults the issue date to today and the due date to the Booking
 * date, so the admin types nothing. The pure guard mirrors the database's
 * refusals and adds the duplicate rule before the call, so an identical
 * Invoice is answered with "resend the existing one" instead of a new number.
 * Rows carry the number, both dates, DP, remaining balance, Payment Status and
 * sent state; selecting one is kept for the picture preview in ticket 04.
 */
export function InvoiceDialog({
  booking,
  serviceName,
  invoices,
  onCreated,
  onClose,
  returnFocusTo,
  restoreFocus = false,
}: InvoiceDialogProps) {
  const [issuedOn, setIssuedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const open = booking !== null;

  // Every opening starts from the two defaults; reopening the same Booking
  // must not keep a date the admin happened to try last time.
  useEffect(() => {
    if (!booking) return;
    setIssuedOn(getTodayKey());
    setDueOn(booking.date);
    setCreating(false);
    setCreateError(null);
  }, [booking?.id]);

  // Select the newest Invoice at open, and after a create. A selection that
  // still exists survives a list refresh; otherwise the newest becomes active.
  useEffect(() => {
    if (!open) return;
    setSelectedId((current) =>
      current && invoices.some((invoice) => invoice.id === current)
        ? current
        : (invoices[0]?.id ?? null),
    );
  }, [open, invoices]);

  const rows = invoices;
  const newest = rows[0] ?? null;
  const refusal = booking
    ? invoiceIssueRefusal(
        { booking, serviceName, issuedOn, dueOn },
        newest,
      )
    : null;

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || creating || refusal) return;
    setCreating(true);
    setCreateError(null);
    try {
      const invoice = await createInvoice(supabaseBrowser(), {
        bookingId: booking.id,
        issuedOn,
        dueOn,
      });
      onCreated(invoice);
      setSelectedId(invoice.id);
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Gagal menerbitkan invoice. Coba lagi.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={booking ? `Invoice ${booking.client_name}` : "Invoice"}
      returnFocusTo={returnFocusTo}
      restoreFocus={restoreFocus}
    >
      {booking ? (
        <>
          <form
            onSubmit={onCreate}
            className="space-y-3 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4"
          >
            <h3 className="text-sm font-bold">Terbitkan invoice baru</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Tanggal terbit</span>
                <input
                  type="date"
                  required
                  value={issuedOn}
                  onChange={(e) => setIssuedOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Jatuh tempo</span>
                <input
                  type="date"
                  required
                  value={dueOn}
                  onChange={(e) => setDueOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            {refusal ? (
              <p role="status" className="text-sm text-amber-800">
                {refusal}
              </p>
            ) : null}
            {createError ? (
              <p role="alert" className="text-sm text-red-600">
                {createError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={creating || refusal !== null}
              className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
            >
              {creating ? "Menerbitkan…" : "Terbitkan invoice"}
            </button>
          </form>

          <section aria-label="Daftar invoice" className="mt-4">
            <h3 className="text-sm font-bold">Invoice booking ini</h3>
            {rows.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-600">
                Belum ada invoice untuk booking ini.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {rows.map((invoice) => {
                  const position = paymentPosition(
                    invoice.subtotal,
                    invoice.dp_amount,
                  );
                  const selected = invoice.id === selectedId;
                  return (
                    <li key={invoice.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedId(invoice.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selected
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-neutral-200 bg-white hover:bg-neutral-50"
                        }`}
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {invoice.number}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              invoiceIsSent(invoice)
                                ? "bg-green-100 text-green-800"
                                : "bg-neutral-100 text-neutral-700"
                            }`}
                          >
                            {invoiceSentLabel(invoice)}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-neutral-600">
                          Terbit {invoice.issued_on} · Jatuh tempo{" "}
                          {invoice.due_on}
                        </span>
                        <span className="mt-0.5 block text-xs text-neutral-600">
                          DP {formatIDR(invoice.dp_amount)} · Sisa{" "}
                          {formatIDR(position.remaining)} · {position.status}
                        </span>
                        {selected ? (
                          <span className="mt-1 block text-xs font-medium text-neutral-700">
                            Dipilih untuk pratinjau
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </Dialog>
  );
}
