import Image from "next/image";
import type { Service } from "@/lib/supabase/database";
import { formatIDR } from "@/lib/format";
import { buildServiceWaLink } from "@/lib/whatsapp";

/** Price list: cover image, IDR price, duration, per-service WA prefill. */
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

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
      {services.map((service) => (
        <li
          key={service.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
        >
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
            <p className="mt-2 text-sm">
              <span className="font-bold">{formatIDR(service.price_idr)}</span>
              <span className="text-stone-500">
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
