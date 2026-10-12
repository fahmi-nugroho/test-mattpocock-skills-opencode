"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { PortfolioItem } from "@/lib/supabase/database";
import {
  filterPortfolioItems,
  getPortfolioCategories,
} from "@/lib/portfolio";
import { buildStyleWaLink } from "@/lib/whatsapp";

/**
 * Filterable portfolio grid with a tap-to-open lightbox.
 * Category filter behavior is unchanged (filterPortfolioItems /
 * getPortfolioCategories); the lightbox navigates within the
 * currently visible (filtered) list and wraps around.
 */
export function PortfolioGrid({
  items,
  waNumber,
}: {
  items: PortfolioItem[];
  waNumber: string;
}) {
  const categories = useMemo(() => getPortfolioCategories(items), [items]);
  const [active, setActive] = useState(categories[0]);
  const visible = useMemo(
    () => filterPortfolioItems(items, active),
    [items, active],
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Trigger element to return focus to on close.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setSelectedIndex(null), []);

  const step = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) =>
        prev === null || visible.length === 0
          ? prev
          : (prev + delta + visible.length) % visible.length,
      );
    },
    [visible.length],
  );

  const goPrev = useCallback(() => step(-1), [step]);

  const goNext = useCallback(() => step(1), [step]);

  const isOpen = selectedIndex !== null;

  // ESC / arrow-key handling. Depends on the open flag (not the index)
  // so Prev/Next navigation doesn't tear down and re-add the listener.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close, goPrev, goNext]);

  // Body scroll lock + initial focus + return focus. Runs only on the
  // real open → close transition (isOpen boolean), not on index change.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  // Normalise an out-of-bounds open index (e.g. the filtered list shrank
  // under an open lightbox) back to null so close-path cleanup always runs.
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= visible.length) {
      setSelectedIndex(null);
    }
  }, [selectedIndex, visible.length]);

  // Guard against the filtered list shrinking under an open lightbox.
  const selectedItem =
    selectedIndex !== null && selectedIndex < visible.length
      ? visible[selectedIndex]
      : null;

  if (items.length === 0) {
    return (
      <p className="text-stone-600">
        Portfolio segera hadir — silakan chat WhatsApp untuk contoh hasil
        terbaru.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kategori portfolio">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={category === active}
            onClick={() => {
              setActive(category);
              setSelectedIndex(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === active
                ? "bg-stone-900 text-amber-50"
                : "bg-stone-200/60 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-stone-600">
          Belum ada karya untuk kategori ini.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
          {visible.map((item, index) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-sm transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setSelectedIndex(index);
                }}
                aria-haspopup="dialog"
                aria-label={`Lihat ${item.title} lebih besar`}
                className="block w-full cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
              >
                <div className="relative aspect-[3/4]">
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                    loading="lazy"
                  />
                </div>
                <p className="truncate px-3 py-2 text-sm font-medium">
                  {item.title}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedItem.title} (${selectedItem.category})`}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="relative aspect-[3/4] max-h-[60vh] w-full bg-stone-100">
              <Image
                src={selectedItem.image_url}
                alt={selectedItem.title}
                fill
                sizes="(max-width: 640px) 100vw, 512px"
                className="object-cover"
                priority
              />
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Tutup pratinjau"
                className="absolute right-3 top-3 rounded-full bg-stone-950/70 px-3 py-1.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Tutup ✕
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {selectedItem.category}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold text-stone-900">
                {selectedItem.title}
              </h3>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Lihat gaya sebelumnya"
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  ← Prev
                </button>
                <p className="text-xs text-stone-500" aria-live="polite">
                  {selectedIndex !== null ? selectedIndex + 1 : 0} / {visible.length}
                </p>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Lihat gaya berikutnya"
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                >
                  Next →
                </button>
              </div>
              <a
                href={buildStyleWaLink(
                  waNumber,
                  selectedItem.title,
                  selectedItem.category,
                )}
                target="_blank"
                rel="noreferrer"
                aria-label={`Tanya gaya ${selectedItem.title} via WhatsApp`}
                className="mt-4 block rounded-full bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Tanya gaya ini via WA
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
