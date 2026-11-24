"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

interface DialogProps {
  /** Controlled open flag; the call site owns it. */
  open: boolean;
  /** Called by Escape, the backdrop, or the close button. */
  onClose: () => void;
  /** The dialog's accessible name and its visible heading. */
  title: string;
  description?: string;
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
  closeDisabled?: boolean;
}

/**
 * Controlled native modal with a scrollable body, backdrop dismissal,
 * and focus restoration to the opening control.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  panelClassName = "max-w-2xl",
  returnFocusTo,
  restoreFocus = true,
  closeDisabled = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Read at close time, so a call site can flip it in the same update that
  // closes the dialog.
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const parentDialog = returnFocusTo.current?.closest("dialog");
    panel.showModal();
    panel.querySelector<HTMLElement>("[data-dialog-focus]")?.focus();

    return () => {
      panel.close();
      if (restoreFocusRef.current) {
        const trigger = returnFocusTo.current;
        const fallback = parentDialog?.querySelector("button");
        (trigger ?? fallback)?.focus({ preventScroll: true });
      }
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  return (
    <dialog
      ref={panelRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(event) => {
        if (!closeDisabled && event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        const panel = event.currentTarget;
        if (event.key !== "Tab" || (event.target as Element).closest("dialog") !== panel) return;

        // Keep edge tabs inside the modal. Native showModal makes the page
        // inert, but the browser can still take focus into its own toolbar.
        const controls = Array.from(panel.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]',
        )).filter((control) =>
          control.tabIndex >= 0 &&
          !control.matches(":disabled") &&
          control.getClientRects().length > 0 &&
          control.closest("dialog") === panel,
        );
        const first = controls[0];
        const last = controls.at(-1);
        const active = panel.ownerDocument.activeElement;
        if (event.shiftKey && active === first && last) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last && first) {
          event.preventDefault();
          first.focus();
        }
      }}
      className={`m-auto max-h-[85dvh] w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl bg-white text-espresso shadow-2xl backdrop:bg-stone-950/60 open:flex ${panelClassName}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2">
        <h2 id={titleId} className="min-w-0 break-words text-base font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          className="min-h-11 rounded-full px-3 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
        >
          Tutup
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {description ? (
          <p id={descriptionId} className="break-words text-sm leading-relaxed text-neutral-700">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </dialog>
  );
}
