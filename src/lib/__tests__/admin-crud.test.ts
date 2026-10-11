import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteRowById,
  insertRow,
  listOrderedBySort,
  updateRowById,
} from "../supabase/admin-crud";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

function errResult(message: string) {
  return { data: null, error: { message } };
}

// Seam 2 (adapter): generic admin table helpers with injected client.
// Catches wrong table/payload/order and swallowed errors.
// Misses live RLS behavior.
describe("listOrderedBySort", () => {
  it("selects all rows ordered by sort ascending", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ id: "1" }];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return {
              order: (col: string, opts: unknown) => {
                calls.push(["order", col, opts]);
                return Promise.resolve({ data: rows, error: null });
              },
            };
          },
        };
      },
    };
    await expect(
      listOrderedBySort(asClient(client), "services", "Failed to load services"),
    ).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["select", "*"]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws with the caller label on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: async () => errResult("db down"),
        }),
      }),
    };
    await expect(
      listOrderedBySort(asClient(client), "services", "Failed to load services"),
    ).rejects.toThrow(/Failed to load services: db down/);
  });
});

describe("insertRow", () => {
  it("inserts the payload and returns the single row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { id: "9" };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          insert: (values: unknown) => {
            calls.push(["insert", values]);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
        };
      },
    };
    await expect(
      insertRow(asClient(client), "services", { name: "X" }, "Failed to create"),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["insert", { name: "X" }]);
  });

  it("throws with the caller label on error", async () => {
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => errResult("rls denied"),
          }),
        }),
      }),
    };
    await expect(
      insertRow(asClient(client), "services", {}, "Failed to create"),
    ).rejects.toThrow(/Failed to create: rls denied/);
  });
});

describe("updateRowById", () => {
  it("updates by id and returns the single row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { id: "1" };
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
                    single: async () => ({ data: row, error: null }),
                  }),
                };
              },
            };
          },
        };
      },
    };
    await expect(
      updateRowById(asClient(client), "services", "1", { name: "Y" }, "Failed"),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["eq", "id", "1"]);
    expect(calls).toContainEqual(["update", { name: "Y" }]);
  });

  it("throws with the caller label on error", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => errResult("rls denied"),
            }),
          }),
        }),
      }),
    };
    await expect(
      updateRowById(asClient(client), "services", "1", {}, "Failed"),
    ).rejects.toThrow(/Failed: rls denied/);
  });
});

describe("deleteRowById", () => {
  it("deletes by id", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          delete: () => {
            calls.push(["delete"]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
    await expect(
      deleteRowById(asClient(client), "services", "1", "Failed"),
    ).resolves.toBeUndefined();
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["delete"]);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });

  it("throws with the caller label on error", async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => ({ error: { message: "rls denied" } }),
        }),
      }),
    };
    await expect(
      deleteRowById(asClient(client), "services", "1", "Failed"),
    ).rejects.toThrow(/Failed: rls denied/);
  });
});
