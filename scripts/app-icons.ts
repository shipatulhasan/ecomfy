/**
 * Generates the install (PWA) icons from the logo mark (lib/brand.ts) painted with the
 * storefront color tokens (designs/tokens.json). No hand-made files.
 *
 *   pnpm icons
 *
 * Output (both committed; public/icons is served as-is and doesn't depend on the seed):
 *   designs/assets/app-icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 *   public/icons/… (same files)
 *
 * - icon-*: the mark at 70% on the background color (purpose "any").
 * - maskable-512: the mark at 55%, inside the 80% safe circle, so launchers can crop
 *   it to any shape (purpose "maskable").
 * - apple-touch-icon: 180×180, the mark at 64%. iOS rounds the corners itself.
 */
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { LOGO_MARK } from "../lib/brand";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "designs/assets/app-icons");
const publicDir = resolve(root, "public/icons");

type Tokens = { storefront: { color: Record<string, { value: string }> } };
const tokens = JSON.parse(readFileSync(resolve(root, "designs/tokens.json"), "utf8")) as Tokens;
const color = (name: string) => {
  const v = tokens.storefront.color[name]?.value;
  if (!v) throw new Error(`designs/tokens.json has no storefront.color.${name}`);
  return v;
};

function iconSvg(size: number, markScale: number): string {
  const mark = Math.round(size * markScale);
  const offset = Math.round((size - mark) / 2);
  const leaves = LOGO_MARK.leaves
    .map((l) => `<path d="${l.d}" fill="${color(l.token)}" stroke="${color(l.token)}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="${color("background")}"/>
<svg x="${offset}" y="${offset}" width="${mark}" height="${mark}" viewBox="${LOGO_MARK.viewBox}" stroke-linejoin="round" stroke-width="${LOGO_MARK.strokeWidth}">${leaves}</svg>
</svg>`;
}

const icons: { file: string; size: number; markScale: number }[] = [
  { file: "icon-192.png", size: 192, markScale: 0.7 },
  { file: "icon-512.png", size: 512, markScale: 0.7 },
  { file: "maskable-512.png", size: 512, markScale: 0.55 },
  { file: "apple-touch-icon.png", size: 180, markScale: 0.64 },
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const { file, size, markScale } of icons) {
    await sharp(Buffer.from(iconSvg(size, markScale))).png().toFile(resolve(outDir, file));
  }
  mkdirSync(publicDir, { recursive: true });
  cpSync(outDir, publicDir, { recursive: true });
  console.log(`✔ ${icons.length} app icons → designs/assets/app-icons, public/icons`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
