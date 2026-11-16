import { mediaUrl } from "@/lib/storage/core";

/**
 * Product images are ProductImage → Media rows. Every storefront read selects
 * with `productImageSelect` and maps with `toImage`, so next/image always gets
 * the stored intrinsic size + blur (no layout shift).
 */
export type ImageData = { url: string; alt: string; width: number; height: number; blurDataURL: string | null };

export const imageMediaSelect = {
  key: true,
  alt: true,
  width: true,
  height: true,
  blurDataURL: true,
} as const;

/** `images: productImages(1)` for the main image, `productImages()` for the gallery. */
export const productImages = (take?: number) => ({
  orderBy: { sortOrder: "asc" as const },
  ...(take ? { take } : {}),
  select: { media: { select: imageMediaSelect } },
});

export function toImage(row: { media: { key: string; alt: string; width: number; height: number; blurDataURL: string | null } }, fallbackAlt = ""): ImageData {
  const m = row.media;
  return { url: mediaUrl(m.key), alt: m.alt || fallbackAlt, width: m.width, height: m.height, blurDataURL: m.blurDataURL };
}

export const firstImage = (rows: Parameters<typeof toImage>[0][], alt = "") => (rows[0] ? toImage(rows[0], alt) : null);
