import path from "node:path";

/**
 * Uploaded avatars (Settings → "Choose Image"). Files live outside `public/` in
 * UPLOAD_DIR (default `.data/uploads`, gitignored) and are served by
 * app/api/avatars/[file]/route.ts.
 *
 * Production needs a persistent disk at UPLOAD_DIR, or swap this module for a
 * blob store (S3, Vercel Blob, …) — callers only use these helpers.
 */
export const AVATAR_ROUTE = "/api/avatars";
export const AVATAR_FILE_RE = /^[a-zA-Z0-9_-]{1,64}-[a-f0-9]{16}\.webp$/;

export function avatarDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? ".data/uploads", "avatars");
}

/** The stored file name when `url` is one of our avatar URLs, else null. */
export function avatarFileFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(`${AVATAR_ROUTE}/`)) return null;
  const name = url.slice(AVATAR_ROUTE.length + 1);
  return AVATAR_FILE_RE.test(name) ? name : null;
}
