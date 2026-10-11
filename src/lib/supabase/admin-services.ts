import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Service } from "./database";
import {
  deleteImageBestEffort,
} from "./admin-storage";
import {
  deleteRowById,
  insertRow,
  listOrderedBySort,
  updateRowById,
  type DeleteWithCleanupResult,
} from "./admin-crud";

type TypedClient = SupabaseClient<Database>;

export interface ServiceInsert {
  name: string;
  description: string;
  price_idr: number;
  duration_min: number;
  active: boolean;
  cover_image_url: string | null;
  sort: number;
}

export type ServicePatch = Partial<ServiceInsert>;

/**
 * Admin price/service list (ticket 06): every row ordered by sort,
 * inactive included — unlike the public active-only read in queries.ts.
 * Call with an authenticated browser client (`services_admin_all`).
 */
export async function listServicesAdmin(client: TypedClient): Promise<Service[]> {
  return listOrderedBySort<Service>(
    client,
    "services",
    "Failed to load services",
  );
}

/**
 * Admin price/service create (ticket 06). Caller validates via
 * validateServiceInput; cover upload to `prices/` is optional, passing
 * its public URL as cover_image_url (null when skipped).
 */
export async function createService(
  client: TypedClient,
  input: ServiceInsert,
): Promise<Service> {
  return insertRow<Service>(client, "services", input, "Failed to create service");
}

/**
 * Admin price/service update (ticket 06): partial patch by id.
 */
export async function updateService(
  client: TypedClient,
  id: string,
  patch: ServicePatch,
): Promise<Service> {
  return updateRowById<Service>(
    client,
    "services",
    id,
    patch,
    "Failed to update service",
  );
}

/**
 * Admin price/service delete with storage cleanup (ticket 06): removes
 * the row, then its `prices/` cover when coverUrl parses to that bucket.
 * Row errors propagate so the UI never pretends a failed delete
 * succeeded; a failed storage prune is reported via cleanupOk (row
 * delete already won) so the UI can warn instead of silently orphaning.
 */
export async function deleteService(
  client: TypedClient,
  id: string,
  coverUrl: string | null,
): Promise<DeleteWithCleanupResult> {
  await deleteRowById(client, "services", id, "Failed to delete service");
  const cleanupOk = await deleteImageBestEffort(client, "prices", coverUrl);
  return { cleanupOk };
}
