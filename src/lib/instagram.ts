/**
 * One Instagram-handle rule shared by the settings form and the Invoice
 * picture. The admin may type the handle with or without a leading `@`; we
 * store it without, and the picture adds exactly one back at paint time.
 */

/** The stored handle: no leading `@`, no surrounding blanks. */
export function normaliseInstagramHandle(value: string): string {
  return value.trim().replace(/^@+/, "").trim();
}
