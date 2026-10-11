export interface ServiceInput {
  name: string;
  description?: string;
  price_idr: number;
  duration_min: number;
  active: boolean;
  sort: number;
}

export interface ValidatedServiceInput {
  name: string;
  description: string;
  price_idr: number;
  duration_min: number;
  active: boolean;
  sort: number;
}

/**
 * Validate the admin price/service form (ticket 06).
 * Mirrors the SQL CHECKs (price_idr >= 0, duration_min > 0) so bad
 * rows are rejected before a DB write; trims name and defaults a
 * missing description to "" (same shape as the services table).
 */
export function validateServiceInput(
  input: ServiceInput,
): ValidatedServiceInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Nama layanan tidak boleh kosong");
  }
  if (!Number.isInteger(input.price_idr) || input.price_idr < 0) {
    throw new Error("Harga layanan harus bilangan bulat >= 0 (IDR)");
  }
  if (!Number.isInteger(input.duration_min) || input.duration_min <= 0) {
    throw new Error("Durasi layanan harus bilangan bulat > 0 (menit)");
  }
  if (!Number.isInteger(input.sort) || input.sort < 0) {
    throw new Error("Urutan layanan harus bilangan bulat >= 0");
  }
  return {
    name,
    description: (input.description ?? "").trim(),
    price_idr: input.price_idr,
    duration_min: input.duration_min,
    active: input.active,
    sort: input.sort,
  };
}
