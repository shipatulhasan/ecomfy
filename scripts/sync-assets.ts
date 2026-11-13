/**
 * Copies the committed seed images (designs/assets/<group>, see ASSET_GROUPS)
 * to public/seed, where next/image serves them. public/seed is gitignored.
 * Run automatically by `pnpm db:seed` and `pnpm assets:crop`.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

/** Every image group under designs/assets (and public/seed). */
export const ASSET_GROUPS = [
  "products",
  "categories",
  "banners",
  "blog",
  "avatars",
  "logos",
  "brands",
  "instagram",
  "payments",
  "icons",
] as const;
export type AssetGroup = (typeof ASSET_GROUPS)[number];

export function syncAssets() {
  const target = resolve(root, "public/seed");
  rmSync(target, { recursive: true, force: true });
  for (const dir of ASSET_GROUPS) {
    const src = resolve(root, "designs/assets", dir);
    if (!existsSync(src)) throw new Error(`Missing ${src} — run \`pnpm assets:crop\` first.`);
    cpSync(src, resolve(target, dir), { recursive: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  syncAssets();
  console.log("✔ designs/assets → public/seed");
}
