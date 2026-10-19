import type { Metadata } from "next";
import { RequestForm } from "@/components/request-form";
import { BUSINESS_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Format Booking",
};

/**
 * Public Format Booking page (booking-request-intake ticket 03).
 *
 * The route is keyed by the per-request token the admin sent in chat. There is
 * no auth and nothing secret is rendered server-side: the client form reads its
 * own context through the security-definer `get_booking_request` RPC after
 * mount, so the page itself only awaits the async `params` and hands the token
 * to the form.
 */
export default async function RequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-md bg-cream px-4 py-10 text-espresso">
      <p className="text-center text-sm font-medium uppercase tracking-widest text-gold">
        {BUSINESS_NAME}
      </p>
      <h1 className="mt-2 text-center font-display text-2xl font-bold">
        Format Booking
      </h1>
      <RequestForm token={token} />
    </main>
  );
}
