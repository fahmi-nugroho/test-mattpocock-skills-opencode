import Image from "next/image";
import type { Service } from "@/lib/supabase/database";
import { formatIDR } from "@/lib/format";
import { buildGeneralWaLink, buildServiceWaLink } from "@/lib/whatsapp";
import { FEATURED_BADGE_LABEL, getFeaturedService } from "@/lib/featured-service";

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
        Harga belum tersedia.{" "}
        <a href={buildGeneralWaLink(waNumber)} target="_blank" rel="noreferrer" className="font-semibold text-green-800 underline underline-offset-4">
          Tanya harga via WhatsApp
        </a>.
      </p>
    );
  }

  const featuredId = getFeaturedService(services)?.id;
  const singleService = services.length === 1;

  return (
    <ul className={`grid gap-4 ${singleService ? "max-w-3xl" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {services.map((service) => {
        const description = service.description.trim();
        const sidePoster = singleService && service.cover_image_url;
        return (
          <li
            key={service.id}
            className={`grid overflow-hidden rounded-2xl border border-stone-200 bg-white ${sidePoster ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]" : "grid-rows-[1fr_auto]"}`}
          >
            <div className="flex min-w-0 flex-col items-start p-4 sm:p-6">
              {service.id === featuredId ? (
                <span className="mb-2 rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold-deep">
                  {FEATURED_BADGE_LABEL}
                </span>
              ) : null}
              <h3 className="break-words font-display text-xl font-bold">{service.name}</h3>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xl font-semibold tabular-nums sm:text-2xl">{formatIDR(service.price_idr)}</span>
                <span className="whitespace-nowrap text-sm text-stone-600">{service.duration_min} menit</span>
              </p>
              {description && description.toLowerCase() !== service.name.trim().toLowerCase() ? (
                <p className="mt-3 max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-stone-700">
                  {description}
                </p>
              ) : null}
              <a
                href={buildServiceWaLink(waNumber, service.name)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Tanya ${service.name} via WhatsApp`}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-800"
              >
                Tanya via WhatsApp
              </a>
            </div>
            {service.cover_image_url ? (
              <a
                href={service.cover_image_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Lihat poster lengkap ${service.name} (tab baru)`}
                className={`flex items-center gap-3 border-t border-stone-200 bg-cream px-4 py-3 text-sm font-semibold text-espresso hover:bg-gold-soft focus-visible:-outline-offset-2 ${sidePoster ? "sm:border-l sm:border-t-0" : ""}`}
              >
                <span className="relative block h-20 w-12 shrink-0">
                  <Image src={service.cover_image_url} alt="" fill sizes="48px" className="object-contain" />
                </span>
                <span className="underline underline-offset-4">Lihat poster lengkap</span>
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
