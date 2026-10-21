/**
 * Build a wa.me deep link with a prefilled message.
 * The number is normalised to digits only (leading "+" / spaces /
 * dashes stripped) so stored formats like "+62 812-..." still work.
 */
export function buildWaLink(number: string, template: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(template)}`;
}

/**
 * Ticket 03 ID copy: general chat starter (no date prefill — date/time
 * is negotiated in chat) and per-service prefill "Halo, mau tanya [service]".
 */
export const GENERAL_WA_MESSAGE =
  "Halo, mau tanya jadwal makeup";

export function buildServiceWaMessage(serviceName: string): string {
  return `Halo, mau tanya ${serviceName}`;
}

export function buildServiceWaLink(
  number: string,
  serviceName: string,
): string {
  return buildWaLink(number, buildServiceWaMessage(serviceName));
}

export function buildGeneralWaLink(number: string): string {
  return buildWaLink(number, GENERAL_WA_MESSAGE);
}

/**
 * Per-date chat starter (ticket 01 of calendar-day-detail): date only,
 * no time prefill — time is still negotiated in chat.
 */
export function buildDateWaMessage(date: string): string {
  return `Halo, mau tanya jadwal makeup tanggal ${date}`;
}

export function buildDateWaLink(number: string, date: string): string {
  return buildWaLink(number, buildDateWaMessage(date));
}

/**
 * Per-date-plus-time chat starter (ticket 03 of calendar-popup-inquiry):
 * the date message with the client-chosen start-end range appended, so
 * the admin sees exactly what slot is proposed. The date-only builders
 * above stay byte-identical for the secondary time-less action.
 */
export function buildDateTimeWaMessage(
  date: string,
  start: string,
  end: string,
): string {
  return `${buildDateWaMessage(date)} jam ${start}-${end}`;
}

export function buildDateTimeWaLink(
  number: string,
  date: string,
  start: string,
  end: string,
): string {
  return buildWaLink(number, buildDateTimeWaMessage(date, start, end));
}

/**
 * Per-style chat starter for the portfolio lightbox CTA
 * (ticket 03 of ui-ux-polish): title + category prefill so the
 * client can ask about a look in one tap.
 */
export function buildStyleWaMessage(title: string, category: string): string {
  return `Halo, mau tanya gaya ${title} (${category})`;
}

export function buildStyleWaLink(
  number: string,
  title: string,
  category: string,
): string {
  return buildWaLink(number, buildStyleWaMessage(title, category));
}

/**
 * Format Booking chat starter (ticket 04 of booking-request-intake): the
 * admin sends the per-request link so the client fills a short form instead
 * of retyping the whole text format. Indonesian, carries the link; the link
 * itself is built by buildFormatBookingLink.
 */
export function buildFormatBookingWaMessage(link: string): string {
  return `Halo, silakan isi format booking lewat link ini: ${link}`;
}

export function buildFormatBookingWaLink(
  number: string,
  link: string,
): string {
  return buildWaLink(number, buildFormatBookingWaMessage(link));
}

/**
 * Invoice chat starter (ticket 05 of invoice-and-booking-filter): the admin
 * opens the client's existing WhatsApp conversation with a message naming
 * the client and the invoice number, so the client knows which picture to
 * look for. The PNG itself is attached or shared separately; nothing here
 * uploads or marks the Invoice sent.
 */
export function buildInvoiceWaMessage(
  clientName: string,
  invoiceNumber: string,
): string {
  return `Halo ${clientName}, berikut invoice ${invoiceNumber} untuk booking Anda.`;
}

export function buildInvoiceWaLink(
  number: string,
  clientName: string,
  invoiceNumber: string,
): string {
  return buildWaLink(
    number,
    buildInvoiceWaMessage(clientName, invoiceNumber),
  );
}
