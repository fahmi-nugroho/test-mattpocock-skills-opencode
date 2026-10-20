"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { Dialog } from "@/components/dialog";
import { getTodayKey } from "@/lib/calendar";
import {
  invoiceDateEditRefusal,
  invoiceIsSent,
  invoiceIssueRefusal,
  invoiceSentLabel,
  paymentPosition,
  type InvoiceBusiness,
} from "@/lib/admin/invoice";
import { formatIDR } from "@/lib/format";
import { InvoicePreview } from "./invoice-preview";
import {
  createInvoice,
  deleteInvoice,
  setInvoiceSent,
  updateInvoiceDates,
} from "@/lib/supabase/admin-invoices";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Booking, Invoice } from "@/lib/supabase/database";

interface InvoiceDialogProps {
  /** The Booking whose Invoices are shown; null while the dialog is closed. */
  booking: Booking | null;
  /** The Booking's service name, or "" when the service is gone (as 0018 stores it). */
  serviceName: string;
  /** Every loaded Invoice for this Booking, newest first. */
  invoices: readonly Invoice[];
  /** Business name and the payment details printed on the picture. */
  business: InvoiceBusiness;
  /** Settings read failed, so the picture falls back to em dashes. */
  businessLoadFailed?: boolean;
  /** The new Invoice, so the manager's row summary updates without a reload. */
  onCreated: (invoice: Invoice) => void;
  /** A marked/unmarked or re-dated Invoice, so the list and row follow at once. */
  onUpdated: (invoice: Invoice) => void;
  /** A deleted Invoice id, so the list and the booking row's count follow at once. */
  onDeleted: (invoiceId: string) => void;
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
  business,
  businessLoadFailed = false,
  onCreated,
  onUpdated,
  onDeleted,
  onClose,
  returnFocusTo,
  restoreFocus = false,
}: InvoiceDialogProps) {
  const [issuedOn, setIssuedOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Lifecycle actions: the sent mark, the date correction on an unsent row,
  // and the two-click delete. None of them touches the Booking snapshot.
  const [busyAction, setBusyAction] = useState<
    "sent" | "dates" | "delete" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const [editIssuedOn, setEditIssuedOn] = useState("");
  const [editDueOn, setEditDueOn] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const open = booking !== null;

  /** Abandon a half-started correction or delete confirmation. */
  const resetActions = useCallback(() => {
    setActionError(null);
    setDateEditId(null);
    setConfirmDeleteId(null);
  }, []);

  // Every opening starts from the two defaults; reopening the same Booking
  // must not keep a date the admin happened to try last time.
  useEffect(() => {
    if (!booking) return;
    setIssuedOn(getTodayKey());
    setDueOn(booking.date);
    setCreating(false);
    setCreateError(null);
    resetActions();
  }, [booking?.id, resetActions]);

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

  // Moving to another Invoice abandons a half-started correction or delete
  // confirmation rather than letting it land on the newly selected row.
  useEffect(() => {
    resetActions();
  }, [selectedId, resetActions]);

  const rows = invoices;
  const newest = rows[0] ?? null;
  const selected = rows.find((invoice) => invoice.id === selectedId) ?? null;
  const selectedSent = selected ? invoiceIsSent(selected) : false;
  const datesRefusal =
    selected && dateEditId === selected.id
      ? invoiceDateEditRefusal(selected, {
          issuedOn: editIssuedOn,
          dueOn: editDueOn,
        })
      : null;
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

  /**
   * Run one lifecycle action at a time. Every action writes through an
   * adapter, reports the database's plain Indonesian refusal inline, and
   * leaves the Booking snapshot untouched.
   */
  async function runAction(
    action: "sent" | "dates" | "delete",
    fallback: string,
    write: () => Promise<void>,
  ) {
    if (busyAction) return;
    setBusyAction(action);
    setActionError(null);
    try {
      await write();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusyAction(null);
    }
  }

  /** Mark sent / take the mark back. Never a side effect of sharing. */
  async function toggleSent(invoice: Invoice) {
    await runAction(
      "sent",
      "Gagal memperbarui status kirim invoice. Coba lagi.",
      async () => {
        const updated = await setInvoiceSent(
          supabaseBrowser(),
          invoice.id,
          !invoiceIsSent(invoice),
        );
        onUpdated(updated);
        resetActions();
      },
    );
  }

  function beginDateEdit(invoice: Invoice) {
    resetActions();
    setDateEditId(invoice.id);
    setEditIssuedOn(invoice.issued_on);
    setEditDueOn(invoice.due_on);
  }

  async function onSaveDates(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busyAction || datesRefusal) return;
    await runAction(
      "dates",
      "Gagal memperbarui tanggal invoice. Coba lagi.",
      async () => {
        const updated = await updateInvoiceDates(
          supabaseBrowser(),
          selected.id,
          { issuedOn: editIssuedOn, dueOn: editDueOn },
        );
        onUpdated(updated);
        setDateEditId(null);
      },
    );
  }

  /** First click arms; the second click deletes. Sent Invoices never show it. */
  async function onDeleteInvoice(invoice: Invoice) {
    if (confirmDeleteId !== invoice.id) {
      setConfirmDeleteId(invoice.id);
      setActionError(null);
      return;
    }
    await runAction(
      "delete",
      "Gagal menghapus invoice. Coba lagi.",
      async () => {
        await deleteInvoice(supabaseBrowser(), invoice.id);
        onDeleted(invoice.id);
        setConfirmDeleteId(null);
      },
    );
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

          {selected ? (
            <section
              aria-label={`Pratinjau ${selected.number}`}
              className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold">Pratinjau {selected.number}</h3>
                <p className="text-xs text-neutral-600">
                  Dari invoice tersimpan, bukan booking saat ini.
                </p>
              </div>
              {businessLoadFailed ? (
                <p role="status" className="mt-2 text-xs text-amber-800">
                  Detail pembayaran gagal dimuat. Pratinjau memakai tanda —
                  sampai halaman dimuat ulang.
                </p>
              ) : null}
              <div className="mt-3">
                <InvoicePreview invoice={selected} business={business} />
              </div>
            </section>
          ) : null}

          {selected ? (
            <section
              aria-label={`Kelola ${selected.number}`}
              className="mt-4 rounded-xl border border-neutral-200 bg-white p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  Kelola {selected.number}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    selectedSent
                      ? "bg-green-100 text-green-800"
                      : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {invoiceSentLabel(selected)}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">
                {selectedSent
                  ? "Invoice yang sudah dikirim terkunci sebagai riwayat. Untuk koreksi, terbitkan invoice baru; batalkan tanda terkirim hanya bila invoice ini benar-benar belum dikirim."
                  : "Invoice belum dikirim. Tanggal masih dapat dikoreksi, dan invoice yang salah dapat dihapus."}
              </p>

              {!selectedSent && dateEditId === selected.id ? (
                <form onSubmit={onSaveDates} className="mt-3 space-y-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium">
                        Tanggal terbit
                      </span>
                      <input
                        type="date"
                        required
                        min={`${selected.year}-01-01`}
                        max={`${selected.year}-12-31`}
                        value={editIssuedOn}
                        onChange={(e) => setEditIssuedOn(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Jatuh tempo</span>
                      <input
                        type="date"
                        required
                        min={editIssuedOn || `${selected.year}-01-01`}
                        value={editDueOn}
                        onChange={(e) => setEditDueOn(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                  {datesRefusal ? (
                    <p role="status" className="text-sm text-amber-800">
                      {datesRefusal}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={busyAction !== null || datesRefusal !== null}
                      className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {busyAction === "dates"
                        ? "Menyimpan…"
                        : "Simpan tanggal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateEditId(null);
                        setActionError(null);
                      }}
                      className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {!selectedSent && dateEditId !== selected.id ? (
                  <button
                    type="button"
                    onClick={() => beginDateEdit(selected)}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                  >
                    Koreksi tanggal
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => toggleSent(selected)}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  {busyAction === "sent"
                    ? "Menyimpan…"
                    : selectedSent
                      ? "Batalkan tanda terkirim"
                      : "Tandai terkirim"}
                </button>
                {!selectedSent ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => onDeleteInvoice(selected)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                      confirmDeleteId === selected.id
                        ? "bg-red-600 text-white"
                        : "border border-red-300 text-red-700"
                    }`}
                  >
                    {busyAction === "delete"
                      ? "Menghapus…"
                      : confirmDeleteId === selected.id
                        ? "Klik lagi untuk hapus"
                        : "Hapus invoice"}
                  </button>
                ) : null}
              </div>
              {actionError ? (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {actionError}
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
