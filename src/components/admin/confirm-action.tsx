"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Dialog } from "@/components/dialog";

export function ConfirmAction({
  label,
  title,
  description,
  onConfirm,
  children,
  disabled = false,
  destructive = false,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: (form: FormData) => Promise<void>;
  children?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState<{
    label: string;
    title: string;
    description: string;
    onConfirm: (form: FormData) => Promise<void>;
    children?: ReactNode;
  } | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled || !confirmation) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await confirmation.onConfirm(form);
    } finally {
      setConfirmation(null);
      setPending(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setConfirmation({ label, title, description, onConfirm, children })}
        className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          destructive
            ? "border-transparent text-red-700 hover:bg-red-50"
            : "border-neutral-300 bg-white hover:bg-neutral-100"
        }`}
      >
        {label}
      </button>
      {confirmation ? (
        <Dialog
          open
          onClose={() => setConfirmation(null)}
          title={confirmation.title}
          description={confirmation.description}
          returnFocusTo={triggerRef}
          panelClassName="max-w-md"
          closeDisabled={pending}
        >
          <form onSubmit={confirm}>
            {confirmation.children ? (
              <fieldset disabled={pending} className="mt-4">
                {confirmation.children}
              </fieldset>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-neutral-200 pt-4">
              <button
                type="button"
                data-dialog-focus
                disabled={pending}
                onClick={() => setConfirmation(null)}
                className="min-h-10 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pending || disabled}
                className={`min-h-10 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  destructive ? "bg-red-700 hover:bg-red-800" : "bg-neutral-900 hover:bg-neutral-700"
                }`}
              >
                {pending ? "Memproses…" : confirmation.label}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
