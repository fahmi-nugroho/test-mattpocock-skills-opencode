import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonialsAdmin,
  updateTestimonial,
} from "../supabase/admin-testimonials";
import type { Database, TestimonialRow } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter): admin testimonial CRUD with injected client, mirroring
// admin-services minus storage. Catches wrong table/payload and swallowed
// errors. Misses live RLS behavior.
function rowResult(data: unknown, error: { message: string } | null = null) {
  return { data, error };
}

const TESTIMONIAL_PAYLOAD = {
  quote: "Riasannya natural tapi tahan lama.",
  client_name: "Dinda, Pengantin",
  sort: 0,
  visible: true,
};

describe("listTestimonialsAdmin", () => {
  it("lists all testimonials ordered by sort (including hidden)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows: TestimonialRow[] = [
      { ...TESTIMONIAL_PAYLOAD, id: "1" },
      { ...TESTIMONIAL_PAYLOAD, id: "2", visible: false },
    ];
    const builder: Record<string, unknown> = {};
    builder.order = (col: string, opts: unknown) => {
      calls.push(["order", col, opts]);
      return Promise.resolve(rowResult(rows));
    };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return builder;
          },
        };
      },
    };
    await expect(listTestimonialsAdmin(asClient(client))).resolves.toEqual(
      rows,
    );
    expect(calls).toContainEqual(["from", "testimonials"]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws instead of rendering a stale list on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: async () => rowResult(null, { message: "db down" }),
        }),
      }),
    };
    await expect(listTestimonialsAdmin(asClient(client))).rejects.toThrow(
      /db down/,
    );
  });
});

describe("createTestimonial", () => {
  it("inserts the validated payload and returns the row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...TESTIMONIAL_PAYLOAD, id: "9" };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          insert: (values: unknown) => {
            calls.push(["insert", values]);
            return {
              select: () => ({
                single: async () => rowResult(row),
              }),
            };
          },
        };
      },
    };
    await expect(
      createTestimonial(asClient(client), TESTIMONIAL_PAYLOAD),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "testimonials"]);
    expect(calls).toContainEqual(["insert", TESTIMONIAL_PAYLOAD]);
  });

  it("propagates insert errors instead of pretending the row saved", async () => {
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => rowResult(null, { message: "rls denied" }),
          }),
        }),
      }),
    };
    await expect(
      createTestimonial(asClient(client), TESTIMONIAL_PAYLOAD),
    ).rejects.toThrow(/rls denied/);
  });
});

describe("updateTestimonial", () => {
  it("updates the row by id and returns it", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...TESTIMONIAL_PAYLOAD, id: "1", quote: "Revisi." };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          update: (values: unknown) => {
            calls.push(["update", values]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return {
                  select: () => ({
                    single: async () => rowResult(row),
                  }),
                };
              },
            };
          },
        };
      },
    };
    await expect(
      updateTestimonial(asClient(client), "1", { quote: "Revisi." }),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });
});

describe("deleteTestimonial", () => {
  it("deletes the row by id", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          delete: () => ({
            eq: (col: string, val: unknown) => {
              calls.push(["eq", col, val]);
              return Promise.resolve(rowResult(null));
            },
          }),
        };
      },
    };
    await deleteTestimonial(asClient(client), "1");
    expect(calls).toContainEqual(["from", "testimonials"]);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });

  it("throws when the row delete fails", async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null, { message: "rls denied" }),
        }),
      }),
    };
    await expect(deleteTestimonial(asClient(client), "1")).rejects.toThrow(
      /rls denied/,
    );
  });
});
