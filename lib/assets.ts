import manifest from "@/designs/assets/manifest.json";

/**
 * Typed access to the design crops in designs/assets/manifest.json
 * (`pnpm assets:crop`), served from /seed/** (`pnpm db:seed` copies them).
 */
export type AssetManifest = typeof manifest;
export type AssetGroup = keyof AssetManifest;
export type AssetSlug<G extends AssetGroup> = keyof AssetManifest[G] & string;
export type Asset = { url: string; width: number; height: number };

export function asset<G extends AssetGroup>(group: G, slug: AssetSlug<G>): Asset {
  const entry = manifest[group][slug] as Asset | undefined;
  if (!entry) throw new Error(`No asset ${group}/${slug} in designs/assets/manifest.json`);
  return { url: entry.url, width: entry.width, height: entry.height };
}
