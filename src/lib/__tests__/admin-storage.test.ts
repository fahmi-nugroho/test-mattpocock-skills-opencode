import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteImageBestEffort,
  deleteImageByUrl,
  storagePathFromUrl,
  uploadAdminImage,
} from "../supabase/admin-storage";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 3 (adapter): storage upload/delete with injected client.
// Catches wrong bucket/path handling and swallowed errors.
// Misses live bucket policies.
describe("storagePathFromUrl", () => {
  it("extracts the bucket-relative path from a public URL", () => {
    expect(
      storagePathFromUrl(
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
        "portfolio",
      ),
    ).toBe("abc.jpg");
  });

  it("returns null when the URL is not in the expected bucket", () => {
    expect(
      storagePathFromUrl(
        "https://xyz.supabase.co/storage/v1/object/public/prices/abc.jpg",
        "portfolio",
      ),
    ).toBeNull();
    expect(storagePathFromUrl("not-a-url", "portfolio")).toBeNull();
  });
});

describe("uploadAdminImage", () => {
  it("uploads to the given bucket and returns the public URL", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      storage: {
        from: (bucket: string) => {
          calls.push(["from", bucket]);
          return {
            upload: async (path: string, _file: unknown) => {
              calls.push(["upload", path]);
              return { data: { path }, error: null };
            },
            getPublicUrl: (path: string) => {
              calls.push(["getPublicUrl", path]);
              return {
                data: {
                  publicUrl: `https://xyz.supabase.co/storage/v1/object/public/portfolio/${path}`,
                },
              };
            },
          };
        },
      },
    };
    const file = new Blob(["img"], { type: "image/jpeg" });
    const url = await uploadAdminImage(asClient(client), "portfolio", file, "jpg");
    expect(url).toContain("/portfolio/");
    expect(calls).toContainEqual(["from", "portfolio"]);
    expect(calls.some(([c]) => c === "upload")).toBe(true);
  });

  it("throws instead of saving a row with a missing image URL on error", async () => {
    const client = {
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: { message: "too big" } }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    };
    const file = new Blob(["img"], { type: "image/jpeg" });
    await expect(
      uploadAdminImage(asClient(client), "portfolio", file, "jpg"),
    ).rejects.toThrow(/too big/);
  });
});

describe("deleteImageByUrl", () => {
  it("removes the file path parsed from the public URL", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      storage: {
        from: (bucket: string) => {
          calls.push(["from", bucket]);
          return {
            remove: async (paths: string[]) => {
              calls.push(["remove", paths]);
              return { data: paths, error: null };
            },
          };
        },
      },
    };
    await deleteImageByUrl(
      asClient(client),
      "portfolio",
      "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
    );
    expect(calls).toContainEqual(["from", "portfolio"]);
    expect(calls).toContainEqual(["remove", ["abc.jpg"]]);
  });

  it("no-ops for a null or foreign URL instead of deleting blindly", async () => {
    let removeCalls = 0;
    const client = {
      storage: {
        from: () => ({
          remove: async () => {
            removeCalls += 1;
            return { data: [], error: null };
          },
        }),
      },
    };
    await deleteImageByUrl(asClient(client), "portfolio", null);
    await deleteImageByUrl(asClient(client), "portfolio", "https://other.cdn/x.jpg");
    expect(removeCalls).toBe(0);
  });

  it("throws when the storage removal fails", async () => {
    const client = {
      storage: {
        from: () => ({
          remove: async () => ({ data: null, error: { message: "denied" } }),
        }),
      },
    };
    await expect(
      deleteImageByUrl(
        asClient(client),
        "portfolio",
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
      ),
    ).rejects.toThrow(/denied/);
  });
});

describe("deleteImageBestEffort", () => {
  it("returns true when the removal succeeds", async () => {
    const client = {
      storage: {
        from: () => ({
          remove: async () => ({ data: ["abc.jpg"], error: null }),
        }),
      },
    };
    await expect(
      deleteImageBestEffort(
        asClient(client),
        "portfolio",
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
      ),
    ).resolves.toBe(true);
  });

  it("returns true when there is nothing to clean up", async () => {
    let removeCalls = 0;
    const client = {
      storage: {
        from: () => ({
          remove: async () => {
            removeCalls += 1;
            return { data: [], error: null };
          },
        }),
      },
    };
    await expect(
      deleteImageBestEffort(asClient(client), "portfolio", null),
    ).resolves.toBe(true);
    expect(removeCalls).toBe(0);
  });

  it("returns false instead of throwing when the removal fails", async () => {
    const client = {
      storage: {
        from: () => ({
          remove: async () => ({ data: null, error: { message: "denied" } }),
        }),
      },
    };
    await expect(
      deleteImageBestEffort(
        asClient(client),
        "portfolio",
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
      ),
    ).resolves.toBe(false);
  });
});
