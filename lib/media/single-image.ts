import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ActionError } from "@/lib/actions/result";
import { inspectImage } from "@/lib/media/process";
import { UPLOAD_MIME, UPLOAD_URL_TTL_SECONDS, type UploadMime } from "@/lib/media/upload-rules";
import { getStoreSettings } from "@/lib/queries/settings";
import { publicUrl, storage, storageKeys } from "@/lib/storage";

/**
 * One-off images (admin profile photo, store logo / favicon, OG image) through the
 * same Neon flow as Product Media: presigned PUT to tmp/ → confirm re-reads the
 * real bytes with sharp, re-encodes to a fixed size, stores the result under its
 * final key and deletes the tmp object (abandoned tmp uploads are swept by
 * `pnpm storage:cleanup`). No Media row: these aren't library images.
 */
export type ImagePurpose = "avatar" | "logo" | "favicon" | "og";

const SPECS: Record<ImagePurpose, { width: number; height: number; fit: "cover" | "inside"; format: "webp" | "png" | "jpeg" }> = {
  avatar: { width: 256, height: 256, fit: "cover", format: "webp" },
  logo: { width: 600, height: 200, fit: "inside", format: "webp" },
  favicon: { width: 96, height: 96, fit: "cover", format: "png" },
  og: { width: 1200, height: 630, fit: "cover", format: "jpeg" },
};

export const TMP_IMAGE_KEY = /^tmp\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

/** Current admin upload rules (Settings → Orders & Media). */
export async function uploadPolicy() {
  const s = await getStoreSettings();
  return { maxMb: s.maxUploadMb, allowed: s.allowedUploadTypes.filter((m): m is UploadMime => m in UPLOAD_MIME) };
}

export function assertAllowed(mime: string, size: number, policy: { maxMb: number; allowed: UploadMime[] }) {
  if (!(policy.allowed as string[]).includes(mime)) {
    throw new ActionError(`Allowed image types: ${policy.allowed.map((m) => UPLOAD_MIME[m].toUpperCase()).join(", ")}.`);
  }
  if (size <= 0 || size > policy.maxMb * 1024 * 1024) throw new ActionError(`Images must be ${policy.maxMb} MB or smaller.`);
}

export async function presignTmpImage(mime: UploadMime, size: number) {
  const policy = await uploadPolicy();
  assertAllowed(mime, size, policy);
  const key = storageKeys.tmp(randomUUID(), UPLOAD_MIME[mime]);
  const url = await storage.getUploadUrl(key, mime, size, UPLOAD_URL_TTL_SECONDS);
  return { key, url, maxMb: policy.maxMb };
}

/** tmp/ upload → processed image under its final key. Returns the public URL. */
export async function finalizeImage(tmpKey: string, purpose: ImagePurpose, ownerId: string): Promise<string> {
  if (!TMP_IMAGE_KEY.test(tmpKey)) throw new ActionError("Unknown upload.");
  const head = await storage.head(tmpKey);
  if (!head) throw new ActionError("The upload didn't arrive. Please retry.");
  try {
    const policy = await uploadPolicy();
    assertAllowed(head.mime ?? "", head.size, policy);
    const buf = await storage.get(tmpKey);
    const info = await inspectImage(buf);
    if (!info || info.mime !== head.mime) throw new ActionError("That file isn't a valid image.");
    const spec = SPECS[purpose];
    const img = sharp(buf).rotate().resize(spec.width, spec.height, { fit: spec.fit, withoutEnlargement: spec.fit === "inside" });
    const out =
      spec.format === "webp" ? await img.webp({ quality: 85 }).toBuffer() : spec.format === "png" ? await img.png().toBuffer() : await img.jpeg({ quality: 85 }).toBuffer();
    const ext = spec.format === "jpeg" ? "jpg" : spec.format;
    const key = purpose === "avatar" ? storageKeys.avatar(ownerId, randomUUID()) : storageKeys.store(purpose, randomUUID(), ext);
    await storage.put(key, out, `image/${spec.format}`);
    return publicUrl(key);
  } finally {
    await storage.delete([tmpKey]).catch(() => {});
  }
}

/** Delete an image this module stored (avatars/…, store/…); anything else (seed, Google) is left alone. */
export async function deleteStoredImage(url: string | null | undefined) {
  if (!url) return;
  const prefix = publicUrl("");
  if (!url.startsWith(prefix)) return;
  const key = decodeURIComponent(url.slice(prefix.length));
  if (!/^(avatars|store)\//.test(key)) return;
  await storage.delete([key]).catch((e) => console.error("[media] delete failed", key, e));
}
