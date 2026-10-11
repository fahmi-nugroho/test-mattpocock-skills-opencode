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
      <p className="text-neutral-600">
        Harga belum tersedia — silakan chat WhatsApp untuk info terbaru.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {services.map((service) => (
        <li
          key={service.id}
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        >
          {service.cover_image_url ? (
            <div className="relative aspect-[16/9] bg-neutral-100">
              <Image
                src={service.cover_image_url}
                alt={service.name}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
          <div className="p-4">
            <h3 className="font-semibold">{service.name}</h3>
            {service.description ? (
              <p className="mt-1 text-sm text-neutral-600">
                {service.description}
              </p>
            ) : null}
            <p className="mt-2 text-sm">
              <span className="font-bold">{formatIDR(service.price_idr)}</span>
              <span className="text-neutral-500">
                {" "}
                · {service.duration_min} menit
              </span>
            </p>
            <a
              href={buildServiceWaLink(waNumber, service.name)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Tanya ${service.name} via WhatsApp`}
              className="mt-3 inline-block rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Tanya via WhatsApp
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
