"use client";

import { useEffect, useState } from "react";
import type { InvoiceBusiness } from "@/lib/admin/invoice";
import { renderInvoicePng } from "@/lib/invoice-painter";
import type { Invoice } from "@/lib/supabase/database";

interface InvoicePreviewProps {
  /** The selected saved Invoice; its snapshot, never the live Booking. */
  invoice: Invoice;
  /** Business name and payment details read once from settings. */
  business: InvoiceBusiness;
}

/**
 * The selected Invoice as the example PNG the client will receive
 * (invoice-and-booking-filter ticket 04). Rendering is async because the
 * three document faces are awaited first; on a failed render the dialog
 * shows a plain message instead of an empty box.
 */
export function InvoicePreview({ invoice, business }: InvoicePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    renderInvoicePng(invoice, business)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Gagal menggambar pratinjau invoice. Coba pilih ulang.");
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice, business]);

  if (url) {
    return (
      <img
        src={url}
        alt={`Pratinjau ${invoice.number}`}
        className="mx-auto block w-full max-w-[360px] rounded-sm border border-neutral-200 shadow-sm"
      />
    );
  }

  return (
    <p
      role={error ? "alert" : "status"}
      className={`rounded-xl border border-dashed border-neutral-300 px-3 py-10 text-center text-sm ${
        error ? "text-red-600" : "text-neutral-500"
      }`}
    >
      {error ?? "Menggambar invoice…"}
    </p>
  );
}
