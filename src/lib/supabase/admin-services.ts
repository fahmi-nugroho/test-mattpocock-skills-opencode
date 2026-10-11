import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Service } from "./database";
import { deleteImageByUrl } from "./admin-storage";

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
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        order(
          c: string,
          o: { ascending: boolean },
        ): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await loose
    .from("services")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`Failed to load services: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as Service[];
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
  const loose = client as unknown as {
    from(t: string): {
      insert(v: unknown): {
        select(): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose.from("services").insert(input).select().single();
  if (error) throw new Error(`Failed to create service: ${error.message}`);
  return data as Service;
}

/**
 * Admin price/service update (ticket 06): partial patch by id.
 */
export async function updateService(
  client: TypedClient,
  id: string,
  patch: ServicePatch,
): Promise<Service> {
  const loose = client as unknown as {
    from(t: string): {
      update(v: unknown): {
        eq(c: string, v: string): {
          select(): {
            single(): Promise<{
              data: unknown;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
  const { data, error } = await loose
    .from("services")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update service: ${error.message}`);
  return data as Service;
}

/**
 * Admin price/service delete with storage cleanup (ticket 06): removes
 * the row, then its `prices/` cover when coverUrl parses to that bucket.
 * Storage errors are best-effort (row delete already won); row errors
 * propagate so the UI never pretends a failed delete succeeded.
 */
export async function deleteService(
  client: TypedClient,
  id: string,
  coverUrl: string | null,
): Promise<void> {
  const loose = client as unknown as {
    from(t: string): {
      delete(): {
        eq(
          c: string,
          v: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose.from("services").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete service: ${error.message}`);
  try {
    await deleteImageByUrl(client, "prices", coverUrl);
  } catch {
    // Best-effort: the row is gone; an orphaned object is harmless
    // (public-read bucket, no PII) and can be pruned from storage.
  }
}
