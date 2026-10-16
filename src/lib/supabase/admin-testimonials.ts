import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TestimonialRow } from "./database";
import {
  deleteRowById,
  insertRow,
  listOrderedBySort,
  updateRowById,
} from "./admin-crud";

type TypedClient = SupabaseClient<Database>;

export interface TestimonialInsert {
  quote: string;
  client_name: string;
  sort: number;
  visible: boolean;
}

export type TestimonialPatch = Partial<TestimonialInsert>;

/**
 * Admin testimonial list (ticket 02): every row ordered by sort, hidden
 * included — unlike the public visible-only read in queries.ts. Text-only
 * table, so no storage cleanup (unlike services/portfolio covers). Call
 * with an authenticated browser client (`testimonials_admin_all`).
 */
export async function listTestimonialsAdmin(
  client: TypedClient,
): Promise<TestimonialRow[]> {
  return listOrderedBySort<TestimonialRow>(
    client,
    "testimonials",
    "Failed to load testimonials",
  );
}

/**
 * Admin testimonial create (ticket 02). Caller validates via
 * validateTestimonialInput.
 */
export async function createTestimonial(
  client: TypedClient,
  input: TestimonialInsert,
): Promise<TestimonialRow> {
  return insertRow<TestimonialRow>(
    client,
    "testimonials",
    input,
    "Failed to create testimonial",
  );
}

/**
 * Admin testimonial update (ticket 02): partial patch by id (quote edit,
 * visible toggle, sort reorder, delete flow all go through here except
 * the final delete).
 */
export async function updateTestimonial(
  client: TypedClient,
  id: string,
  patch: TestimonialPatch,
): Promise<TestimonialRow> {
  return updateRowById<TestimonialRow>(
    client,
    "testimonials",
    id,
    patch,
    "Failed to update testimonial",
  );
}

/**
 * Admin testimonial delete (ticket 02): row only, no storage object to
 * prune (text-only table). Row errors propagate so the UI never pretends
 * a failed delete succeeded.
 */
export async function deleteTestimonial(
  client: TypedClient,
  id: string,
): Promise<void> {
  await deleteRowById(client, "testimonials", id, "Failed to delete testimonial");
}
