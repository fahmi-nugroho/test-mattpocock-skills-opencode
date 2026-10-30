import Image from "next/image";
import type { Service } from "@/lib/supabase/database";
import { formatIDR } from "@/lib/format";
import { buildServiceWaLink } from "@/lib/whatsapp";
import {
  FEATURED_BADGE_LABEL,
  getFeaturedService,
} from "@/lib/featured-service";

/**
 * Price list: cover image, prominent IDR price with subtle duration,
 * per-service WA prefill. Exactly one "Paling Dipilih" badge renders
 * on the first active service by ascending sort (none when empty) —
 * the owner controls it through the existing sort field.
 *
 * Phones get a scannable horizontal row (thumbnail + details); from sm
 * up the card is the original vertical image-first card.
 */
export function PriceList({
  services,
  waNumber,
}: {
  services: Service[];
  waNumber: string;
}) {
  if (services.length === 0) {
    return (
      <p className="text-stone-600">
        Harga belum tersedia — silakan chat WhatsApp untuk info terbaru.
      </p>
    );
  }

  const featuredId = getFeaturedService(services)?.id;

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {services.map((service) => {
        const isFeatured = service.id === featuredId;
        return (
          <li
            key={service.id}
            className="relative flex overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm sm:flex-col"
          >
            {service.cover_image_url ? (
              <div className="relative w-24 shrink-0 overflow-hidden bg-stone-100 sm:aspect-[4/3] sm:w-full">
                <Image
                  src={service.cover_image_url}
                  alt={service.name}
                  fill
                  sizes="(max-width: 640px) 96px, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
              {isFeatured ? (
                <span className="mb-1 self-start rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gold-deep shadow-sm sm:absolute sm:left-2 sm:top-2 sm:z-10 sm:mb-0 sm:text-xs">
                  {FEATURED_BADGE_LABEL}
                </span>
              ) : null}
              <h3 className="text-sm font-semibold sm:text-base">
                {service.name}
              </h3>
              {service.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-stone-600 sm:text-sm">
                  {service.description}
                </p>
              ) : null}
              <p className="mt-2">
                <span className="text-lg font-extrabold sm:text-xl">
                  {formatIDR(service.price_idr)}
                </span>
                <span className="whitespace-nowrap text-xs text-stone-500">
                  {" "}
                  · {service.duration_min} menit
                </span>
              </p>
              <a
                href={buildServiceWaLink(waNumber, service.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Tanya ${service.name} via WhatsApp`}
                className="mt-3 inline-block rounded-full bg-green-700 px-4 py-2 text-center text-xs font-semibold text-white transition hover:bg-green-800 sm:text-sm"
              >
                Tanya via WhatsApp
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
