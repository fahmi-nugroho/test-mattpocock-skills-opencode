/** Max admin upload size: rejects oversize files before a storage call. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageFileLike {
  type: string;
  size: number;
}

/**
 * Shared admin image check (ticket 06 follow-up). Both CRUD managers
 * upload images, so the image/* + 5 MB gate lives here once instead of
 * as a duplicated local helper per manager.
 */
export function checkImageFile(file: ImageFileLike): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran gambar maksimal 5 MB");
  }
}
