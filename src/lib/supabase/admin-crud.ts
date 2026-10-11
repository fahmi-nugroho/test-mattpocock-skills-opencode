import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

type TypedClient = SupabaseClient<Database>;

export interface DeleteWithCleanupResult {
  /** False when the row is gone but its storage object may be orphaned. */
  cleanupOk: boolean;
}

/**
 * Shared admin table helpers (ticket 06 follow-up). Portfolio and price
 * adapters had the same list/insert/update/delete shape differing only
 * in table + error label, so the shape lives here once; per-table
 * modules stay thin wrappers with their domain types and docs.
 * Call with an authenticated browser client so the `*_admin_all`
 * RLS policies apply.
 */
export async function listOrderedBySort<T>(
  client: TypedClient,
  table: string,
  errorLabel: string,
): Promise<T[]> {
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
    .from(table)
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`${errorLabel}: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as T[];
}

export async function insertRow<T>(
  client: TypedClient,
  table: string,
  values: unknown,
  errorLabel: string,
): Promise<T> {
  const loose = client as unknown as {
    from(t: string): {
      insert(v: unknown): {
        select(): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose.from(table).insert(values).select().single();
  if (error) throw new Error(`${errorLabel}: ${error.message}`);
  return data as T;
}

export async function updateRowById<T>(
  client: TypedClient,
  table: string,
  id: string,
  patch: unknown,
  errorLabel: string,
): Promise<T> {
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
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`${errorLabel}: ${error.message}`);
  return data as T;
}

export async function deleteRowById(
  client: TypedClient,
  table: string,
  id: string,
  errorLabel: string,
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
  const { error } = await loose.from(table).delete().eq("id", id);
  if (error) throw new Error(`${errorLabel}: ${error.message}`);
}
