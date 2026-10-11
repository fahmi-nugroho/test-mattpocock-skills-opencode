import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

type TypedClient = SupabaseClient<Database>;

export type AdminImageBucket = "portfolio" | "prices";

interface StorageBucketApi {
  upload(
    path: string,
    file: unknown,
    options?: Record<string, unknown>,
  ): Promise<{ data: { path: string } | null; error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  remove(
    paths: string[],
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

function bucketApi(client: TypedClient, bucket: AdminImageBucket): StorageBucketApi {
  const loose = client as unknown as {
    storage: { from(b: string): StorageBucketApi };
  };
  return loose.storage.from(bucket);
}

/**
 * Extract the bucket-relative storage path from a Supabase public URL.
 * Returns null for foreign/malformed URLs so delete callers never
 * remove a file they didn't parse (ticket 06 storage cleanup).
 */
export function storagePathFromUrl(
  url: string,
  bucket: AdminImageBucket,
): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path ? path : null;
}

function extensionFor(file: Blob, fallbackExt: string): string {
  const fromType = file.type.split("/")[1]?.split("+")[0]?.trim();
  const ext = (fromType || fallbackExt).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return ext || "jpg";
}

/**
 * Admin image upload (ticket 06). Uploads to `portfolio/` or `prices/`
 * (public-read, authenticated-write per 0003_storage.sql) and returns
 * the public URL to store on the row. Call with an authenticated
 * browser client so the `storage_admin_insert` policy applies.
 */
export async function uploadAdminImage(
  client: TypedClient,
  bucket: AdminImageBucket,
  file: Blob,
  fallbackExt = "jpg",
): Promise<string> {
  const ext = extensionFor(file, fallbackExt);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const api = bucketApi(client, bucket);
  const { error } = await api.upload(unique, file, {
    contentType: file.type || `image/${ext}`,
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload image: ${error.message}`);
  return api.getPublicUrl(unique).data.publicUrl;
}

/**
 * Delete a storage object given its public URL (ticket 06
 * delete-with-storage-cleanup). Null/foreign URLs are a no-op so
 * rows with hand-pasted or already-cleaned URLs delete safely.
 */
export async function deleteImageByUrl(
  client: TypedClient,
  bucket: AdminImageBucket,
  url: string | null,
): Promise<void> {
  if (!url) return;
  const path = storagePathFromUrl(url, bucket);
  if (!path) return;
  const { error } = await bucketApi(client, bucket).remove([path]);
  if (error) throw new Error(`Failed to delete image: ${error.message}`);
}

/**
 * Best-effort storage prune (ticket 06 follow-up). Wraps
 * deleteImageByUrl for callers where the row write already won: returns
 * true when no known orphan remains (cleaned, or nothing to clean),
 * false when a parsed removal failed so the UI can warn. Never throws.
 */
export async function deleteImageBestEffort(
  client: TypedClient,
  bucket: AdminImageBucket,
  url: string | null,
): Promise<boolean> {
  try {
    await deleteImageByUrl(client, bucket, url);
    return true;
  } catch {
    return false;
  }
}
