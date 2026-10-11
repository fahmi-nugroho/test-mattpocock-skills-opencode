import { buildGeneralWaLink } from "@/lib/whatsapp";

/** Floating general WA chat button (ID copy, no date prefill). */
export function WaFloat({ waNumber }: { waNumber: string }) {
  return (
    <a
      href={buildGeneralWaLink(waNumber)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat WhatsApp"
      className="fixed bottom-5 right-5 z-50 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-green-700"
    >
      Chat WhatsApp
    </a>
  );
}
