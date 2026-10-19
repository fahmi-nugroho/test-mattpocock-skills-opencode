"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

interface DialogProps {
  /** Controlled open flag; the call site owns it. */
  open: boolean;
  /** Called by Escape, the backdrop, or the close button. */
  onClose: () => void;
  /** The dialog's accessible name and its visible heading. */
  title: string;
  children: ReactNode;
  /**
   * Extra classes for the panel, for a call site that needs a different
   * shape. There is no variant enum: the default panel is the only shape.
   */
  panelClassName?: string;
  /** The control that opened the dialog; focus returns here on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
  /**
   * Whether closing returns focus to the trigger. A close that navigates
   * somewhere else (the Permintaan "Jadikan Booking" hand-off) turns this off
   * so the browser's own fragment target keeps the next Tab in the right place.
   */
  restoreFocus?: boolean;
}

/**
 * The admin dashboard's shared dialog (form-layout-polish ticket 03). It owns
 * the overlay, Escape dismissal, backdrop dismissal, the body scroll-lock,
 * moving focus into the panel on open and returning it to the trigger on
 * close, a titled panel with a close button, and an internally scrolling
 * body so a phone-sized screen still reaches every row.
 *
 * It is a controlled component — `open` plus `onClose` — so a manager's
 * existing open/close state stays where it was. The two modals on the public
 * site are deliberately not built on it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  panelClassName = "",
  returnFocusTo,
  restoreFocus = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  // The latest onClose without making it an effect dependency: managers pass
  // an inline arrow, and re-running the open effect on every render would
  // re-lock scroll and steal focus back to the panel.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Read at close time, so a call site can flip it in the same update that
  // closes the dialog.
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      // preventScroll: a close must not drag the page away from where the
      // admin was working.
      if (restoreFocusRef.current) {
        returnFocusTo.current?.focus({ preventScroll: true });
      }
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/60"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl outline-none ${panelClassName}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <h2 id={titleId} className="text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm font-semibold transition hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
