/** Upload rules shared by the admin uploader (fast feedback) and the server actions (authoritative). */
export const UPLOAD_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type UploadMime = keyof typeof UPLOAD_MIME;
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_MIME).join(",");
export const DEFAULT_MAX_UPLOAD_MB = 5;
/** Presigned PUT lifetime. */
export const UPLOAD_URL_TTL_SECONDS = 300;

export const isUploadMime = (m: string): m is UploadMime => m in UPLOAD_MIME;

/** sharp `metadata().format` → mime it must have been uploaded as. */
export const SHARP_FORMAT_MIME: Record<string, UploadMime> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heif: "image/avif", // sharp reports AVIF as heif (compression av1)
  avif: "image/avif",
};

export function uploadProblem(file: { type: string; size: number }, maxMb: number): string | null {
  if (!isUploadMime(file.type)) return "Only JPG, PNG, WebP or AVIF images.";
  if (file.size <= 0) return "The file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `Images must be ${maxMb} MB or smaller.`;
  return null;
}
