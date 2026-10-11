"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { PortfolioItem } from "@/lib/supabase/database";
import {
  filterPortfolioItems,
  getPortfolioCategories,
} from "@/lib/portfolio";

/** Filterable portfolio grid (visible items only, lazy images). */
export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  const categories = useMemo(() => getPortfolioCategories(items), [items]);
  const [active, setActive] = useState(categories[0]);
  const visible = useMemo(
    () => filterPortfolioItems(items, active),
    [items, active],
  );

  if (items.length === 0) {
    return (
      <p className="text-neutral-600">
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
            onClick={() => setActive(category)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === active
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-6 text-neutral-600">
          Belum ada karya untuk kategori ini.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl bg-neutral-100"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
