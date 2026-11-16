import "server-only";
import sharp from "sharp";
import { SHARP_FORMAT_MIME, type UploadMime } from "./upload-rules";

export type ImageInfo = { width: number; height: number; mime: UploadMime; blurDataURL: string };

/**
 * Reads the real image (never trusts the declared type): format, intrinsic size
 * (EXIF orientation applied) and a tiny blur placeholder for next/image.
 * Returns null when the bytes aren't a supported image.
 */
export async function inspectImage(buf: Buffer): Promise<ImageInfo | null> {
  try {
    const img = sharp(buf, { limitInputPixels: 60_000_000, failOn: "error" });
    const meta = await img.metadata();
    const mime = meta.format ? SHARP_FORMAT_MIME[meta.format] : undefined;
    if (!mime || !meta.width || !meta.height) return null;
    const rotated = (meta.orientation ?? 1) >= 5;
    const blur = await sharp(buf).rotate().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
    return {
      width: rotated ? meta.height : meta.width,
      height: rotated ? meta.width : meta.height,
      mime,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  } catch {
    return null;
  }
}
