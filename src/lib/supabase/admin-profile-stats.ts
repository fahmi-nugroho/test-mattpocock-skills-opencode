import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileStatRow } from "./database";
import {
  deleteRowById,
  insertRow,
  listOrderedBySort,
  updateRowById,
} from "./admin-crud";

type TypedClient = SupabaseClient<Database>;

export interface ProfileStatInsert {
  value: string;
  label: string;
  sort: number;
  visible: boolean;
}

export type ProfileStatPatch = Partial<ProfileStatInsert>;

/**
 * Admin stat list (ticket 03): every row ordered by sort, hidden
 * included — unlike the public visible-only read in queries.ts. Text-only
 * table, so no storage cleanup (unlike services/portfolio covers). Call
 * with an authenticated browser client (`profile_stats_admin_all`).
 */
export async function listProfileStatsAdmin(
  client: TypedClient,
): Promise<ProfileStatRow[]> {
  return listOrderedBySort<ProfileStatRow>(
    client,
    "profile_stats",
    "Failed to load profile stats",
  );
}

/**
 * Admin stat create (ticket 03). Caller validates via validateStatInput.
 */
export async function createProfileStat(
  client: TypedClient,
  input: ProfileStatInsert,
): Promise<ProfileStatRow> {
  return insertRow<ProfileStatRow>(
    client,
    "profile_stats",
    input,
    "Failed to create profile stat",
  );
}

/**
 * Admin stat update (ticket 03): partial patch by id (value/label edit,
 * visible toggle, sort reorder, delete flow all go through here except
 * the final delete).
 */
export async function updateProfileStat(
  client: TypedClient,
  id: string,
  patch: ProfileStatPatch,
): Promise<ProfileStatRow> {
  return updateRowById<ProfileStatRow>(
    client,
    "profile_stats",
    id,
    patch,
    "Failed to update profile stat",
  );
}

/**
 * Admin stat delete (ticket 03): row only, no storage object to prune
 * (text-only table). Row errors propagate so the UI never pretends a
 * failed delete succeeded.
 */
export async function deleteProfileStat(
  client: TypedClient,
  id: string,
): Promise<void> {
  await deleteRowById(client, "profile_stats", id, "Failed to delete profile stat");
}
