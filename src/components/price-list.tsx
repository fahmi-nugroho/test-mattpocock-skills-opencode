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
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
      {services.map((service) => (
        <li
          key={service.id}
          className={
            service.id === featuredId
              ? "relative flex flex-col overflow-hidden rounded-2xl border border-gold-deep/40 bg-white shadow-md ring-2 ring-gold"
              : "relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
          }
        >
          {service.id === featuredId ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-gold-deep shadow-sm sm:text-xs">
              {FEATURED_BADGE_LABEL}
            </span>
          ) : null}
          {service.cover_image_url ? (
            <div className="relative aspect-[4/3] bg-stone-100">
              <Image
                src={service.cover_image_url}
                alt={service.name}
                fill
                sizes="(max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col p-3 sm:p-4">
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
              <span className="text-xs text-stone-500">
                {" "}
                · {service.duration_min} menit
              </span>
            </p>
            <a
              href={buildServiceWaLink(waNumber, service.name)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Tanya ${service.name} via WhatsApp`}
              className="mt-3 inline-block rounded-full bg-green-600 px-4 py-2 text-center text-xs font-semibold text-white transition hover:bg-green-700 sm:text-sm"
            >
              Tanya via WhatsApp
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
