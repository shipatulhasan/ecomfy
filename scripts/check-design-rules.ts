/**
 * Design-system guardrails for app code (run by `pnpm lint` and `pnpm lint:design`):
 *
 *  1. No hard-coded hex colors — use token utilities (designs/tokens.json → app/theme.css).
 *  2. Only the project breakpoints (tablet: / laptop: / desktop:) — no sm:/md:/lg:/xl:/2xl:,
 *     max-* or arbitrary min-[…]/max-[…] breakpoint variants. Mobile-first: base = mobile.
 *  3. No JS width detection for layout (matchMedia, innerWidth, useIsMobile, …) — CSS only.
 *  4. No spinners — loading states are skeletons (components/ui/skeleton).
 *  5. No px lengths in arbitrary Tailwind values (w-[1320px], text-[18px], …) — rem only,
 *     so the laptop+ fluid root scale (app/globals.css) works. 0–2px (borders,
 *     hairlines) are allowed.
 *  6. No w-screen / 100vw in classes — use w-full / 100% (100vw includes the scrollbar
 *     and causes horizontal scroll). `sizes` strings aren't classes, so they're fine.
 *
 * Vendored shadcn code (components/ui) and hooks/use-mobile.ts (used only by the shadcn
 * Sidebar) are exempt from rules 2–6. Generated files are skipped.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dirs = ["app", "components", "lib", "hooks"];
const skipDirs = new Set(["lib/generated", "node_modules"]);
const skipFiles = new Set(["app/theme.css"]); // generated; hex only in comments
const vendored = (rel: string) => rel.startsWith("components/ui/") || rel === "hooks/use-mobile.ts";
const exts = /\.(tsx?|jsx?|css|mdx?)$/;

type Rule = { name: string; re: RegExp; appliesTo: (rel: string) => boolean; hint: string };

const rules: Rule[] = [
  {
    name: "hex color",
    // Quoted values are skipped: shadcn's chart.tsx uses [stroke='#ccc'] selectors to
    // *override* recharts defaults with tokens.
    re: /(?<![\w&/'])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    appliesTo: () => true,
    hint: "use token utilities (bg-primary, text-brand-dark, …)",
  },
  {
    name: "default breakpoint",
    re: /(?<![\w-])(?:max-)?(?:sm|md|lg|xl|2xl):(?=[\w[!-])/g,
    appliesTo: (rel) => !vendored(rel),
    hint: "use tablet: / laptop: / desktop: (mobile = no prefix)",
  },
  {
    name: "max-/arbitrary breakpoint",
    re: /(?<![\w-])(?:max-(?:tablet|laptop|desktop)|min-\[[^\]]+\]|max-\[[^\]]+\]):/g,
    appliesTo: (rel) => !vendored(rel),
    hint: "mobile-first: style the base, then add tablet: / laptop: / desktop:",
  },
  {
    name: "JS width detection",
    re: /\b(?:matchMedia|innerWidth|outerWidth|useIsMobile|useMediaQuery|useWindowSize)\b/g,
    appliesTo: (rel) => !vendored(rel) && /\.(tsx?|jsx?)$/.test(rel),
    hint: "make layout responsive with CSS breakpoints instead",
  },
  {
    name: "spinner",
    re: /\b(?:animate-spin|Loader2?Icon|LoaderCircleIcon|LoaderPinwheelIcon)\b/g,
    appliesTo: (rel) => !vendored(rel) && /\.(tsx?|jsx?)$/.test(rel),
    hint: "show a <Skeleton> shaped like the content instead of a spinner",
  },
  {
    name: "px length",
    re: /\[[^\]\s"'`]*?(?<![\d.])(?![0-2]px)\d+(?:\.\d+)?px[^\]\s"'`]*\]/g,
    appliesTo: (rel) => !vendored(rel) && /\.(tsx?|jsx?)$/.test(rel),
    hint: "use rem (px / 16) or a Tailwind scale class so the laptop+ root scale applies",
  },
  {
    name: "viewport width",
    re: /\bw-screen\b|\[[^\]\s"'`]*100vw[^\]\s"'`]*\]/g,
    appliesTo: (rel) => !vendored(rel) && /\.(tsx?|jsx?)$/.test(rel),
    hint: "use w-full / 100% — 100vw includes the scrollbar and scrolls the page sideways",
  },
];

const hits: string[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full);
    if (statSync(full).isDirectory()) {
      if (!skipDirs.has(rel)) walk(full);
      continue;
    }
    if (!exts.test(name) || skipFiles.has(rel)) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const rule of rules) {
        if (!rule.appliesTo(rel)) continue;
        for (const m of line.matchAll(rule.re)) {
          hits.push(`${rel}:${i + 1}  ${rule.name}: ${m[0]}  → ${rule.hint}`);
        }
      }
    });
  }
}

for (const d of dirs) {
  try {
    walk(resolve(root, d));
  } catch {
    /* directory may not exist yet */
  }
}

if (hits.length) {
  console.error(`✖ Design rule violations:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("✔ Design rules OK (tokens only, tablet/laptop/desktop breakpoints, rem lengths, CSS-only layout, no spinners).");
