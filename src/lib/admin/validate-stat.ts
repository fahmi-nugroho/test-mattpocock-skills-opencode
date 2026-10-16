import { assertNonNegativeInt } from "./form-number";

export interface StatInput {
  value: string;
  label: string;
  sort: number;
  visible: boolean;
}

/**
 * Validate the admin stat form (ticket 03). Trims value/label so the
 * hero stats stay clean; each mirrors the `1-40 char` DB CHECK, sort
 * mirrors the `sort >= 0` ordering the public list relies on.
 */
export function validateStatInput(input: StatInput): StatInput {
  const value = input.value.trim();
  if (!value) {
    throw new Error("Nilai stat tidak boleh kosong");
  }
  if (value.length > 40) {
    throw new Error("Nilai stat maksimal 40 karakter");
  }
  const label = input.label.trim();
  if (!label) {
    throw new Error("Label stat tidak boleh kosong");
  }
  if (label.length > 40) {
    throw new Error("Label stat maksimal 40 karakter");
  }
  const sort = assertNonNegativeInt(input.sort, "Urutan");
  return { value, label, sort, visible: input.visible };
}
