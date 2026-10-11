import { assertNonNegativeInt } from "./form-number";

export interface PortfolioInput {
  title: string;
  category: string;
  sort: number;
  visible: boolean;
}

/**
 * Validate the admin portfolio form (ticket 06).
 * Trims title/category so filter tabs stay clean; sort mirrors the
 * `sort >= 0` ordering the public grid relies on. Image presence is
 * checked at upload time (storage adapter), not here.
 */
export function validatePortfolioInput(input: PortfolioInput): PortfolioInput {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Judul portfolio tidak boleh kosong");
  }
  const category = input.category.trim();
  if (!category) {
    throw new Error("Kategori portfolio tidak boleh kosong");
  }
  const sort = assertNonNegativeInt(input.sort, "Urutan portfolio");
  return { title, category, sort, visible: input.visible };
}
