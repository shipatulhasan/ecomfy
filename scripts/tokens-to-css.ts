/**
 * Generates app/theme.css from designs/tokens.json.
 * designs/tokens.json is the single source of truth for colors, radius, fonts,
 * layout sizes and the responsive scale. Never edit app/theme.css by hand —
 * run `pnpm tokens`.
 *
 * - `:root`          → storefront tokens (default theme)
 * - `.theme-admin`   → admin overrides (applied by app/admin/layout.tsx; also on
 *                     `body:has(.theme-admin)` so portaled overlays match)
 * - per-layer values (gutter, section gap, type scale) step up mobile-first with
 *   `@variant tablet|laptop|desktop` (breakpoints declared in app/globals.css).
 * Colors are converted from hex to oklch to match shadcn's format.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Token = { value: string };
type ThemeTokens = {
  color: Record<string, Token>;
  radius: Record<string, unknown> & { base: number };
  layout: Record<string, unknown>;
};
type Layered = { values: [number, number, number, number] };
type TypeStep = Layered & { lineHeight: number; weight: number };
type ResponsiveTheme = { gutter?: Layered; sectionGap: Layered; type: Record<string, TypeStep | string> };
type Tokens = {
  storefront: ThemeTokens;
  admin: ThemeTokens;
  shared: {
    shadow: Record<string, string>;
    breakpoints: Record<"tablet" | "laptop" | "desktop", number>;
    responsive: {
      gutter: Layered;
      container: { shop: { value: number } };
      storefront: ResponsiveTheme;
      admin: ResponsiveTheme;
    };
  };
};

const root = resolve(import.meta.dirname, "..");
const tokens = JSON.parse(
  readFileSync(resolve(root, "designs/tokens.json"), "utf8"),
) as Tokens;

// ---------- hex -> oklch (https://bottosson.github.io/posts/oklab/) ----------
function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToOklch(hex: string): string {
  // #RRGGBB, or #RRGGBBAA for translucent tokens (overlay scrim).
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!m?.[1]) throw new Error(`Invalid hex color in tokens.json: ${hex}`);
  const n = parseInt(m[1], 16);
  const alpha = m[2] ? ` / ${Number((parseInt(m[2], 16) / 255).toFixed(3))}` : "";
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;

  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;

  const fmt = (v: number, d: number) => Number(v.toFixed(d)).toString();
  return C < 0.0005
    ? `oklch(${fmt(L, 4)} 0 0${alpha})`
    : `oklch(${fmt(L, 4)} ${fmt(C, 4)} ${fmt(H, 3)}${alpha})`;
}

const px = (n: number) => `${n / 16}rem`;

function colorVars(theme: ThemeTokens) {
  return Object.entries(theme.color).map(
    ([name, t]) => `  --${name}: ${hexToOklch(t.value)}; /* ${t.value} */`,
  );
}

// ---------- responsive layers ----------
const LAYERS = ["tablet", "laptop", "desktop"] as const; // index 1..3; index 0 = mobile base

type VarSet = Record<string, string>[]; // one map per layer (0 = mobile)

function layeredVars(theme: ResponsiveTheme, gutter?: Layered): VarSet {
  const layers: VarSet = [{}, {}, {}, {}];
  for (let i = 0; i < 4; i++) {
    const set = layers[i]!;
    if (gutter) set["--gutter"] = px(gutter.values[i]!);
    set["--section-gap"] = px(theme.sectionGap.values[i]!);
    for (const [name, step] of Object.entries(theme.type)) {
      if (typeof step === "string") continue; // "source" note
      set[`--fs-${name}`] = px(step.values[i]!);
      if (i === 0) {
        set[`--lh-${name}`] = String(step.lineHeight);
        set[`--fw-${name}`] = String(step.weight);
      }
    }
  }
  // Only emit a layer's value when it changes from the previous layer.
  for (let i = 3; i >= 1; i--) {
    for (const [k, v] of Object.entries(layers[i]!)) {
      let prev: string | undefined;
      for (let j = i - 1; j >= 0 && prev === undefined; j--) prev = layers[j]![k];
      if (prev === v) delete layers[i]![k];
    }
  }
  return layers;
}

function layeredBlock(layers: VarSet, indent = "  ") {
  const lines = Object.entries(layers[0]!).map(([k, v]) => `${indent}${k}: ${v};`);
  LAYERS.forEach((name, idx) => {
    const set = Object.entries(layers[idx + 1]!);
    if (!set.length) return;
    lines.push(`${indent}@variant ${name} {`);
    lines.push(...set.map(([k, v]) => `${indent}  ${k}: ${v};`));
    lines.push(`${indent}}`);
  });
  return lines.join("\n");
}

// Breakpoints are declared in app/globals.css (@theme). Keep tokens.json in sync.
const globalsCss = readFileSync(resolve(root, "app/globals.css"), "utf8");
for (const name of LAYERS) {
  const want = `--breakpoint-${name}: ${tokens.shared.breakpoints[name] / 16}rem`;
  if (!globalsCss.includes(want)) {
    throw new Error(`app/globals.css must declare "${want};" to match designs/tokens.json`);
  }
}

// Semantic colors beyond shadcn's set — exposed as Tailwind utilities
// (bg-success, text-sale, bg-footer, ...).
const extraColors = [
  "text-body",
  "text-subtle",
  "muted-strong",
  "brand-dark",
  "brand-light",
  "brand-ink",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "warning-strong",
  "sale",
  "sale-soft",
  "info",
  "info-foreground",
  "info-soft",
  "info-strong",
  "footer",
  "footer-foreground",
  "footer-muted",
  "primary-hover",
  "destructive-foreground",
  "overlay",
  "logo-leaf",
  "auth-hero-from",
  "auth-hero-to",
  "swatch-mint",
  "swatch-rose",
  "swatch-silver",
  "swatch-cream",
  "swatch-graphite",
];

const sf = tokens.storefront;
const ad = tokens.admin;
const rs = tokens.shared.responsive;

// Admin doesn't define footer tokens; storefront doesn't define sidebar/chart
// tokens. Keep both themes complete so every utility resolves in either scope.
for (const key of ["primary-hover"]) {
  if (!sf.color[key]) sf.color[key] = sf.color["brand-dark"]!;
}
for (const key of Object.keys(ad.color)) {
  if (key.startsWith("sidebar") || key.startsWith("chart") || key.startsWith("auth-hero") || key.startsWith("swatch")) {
    sf.color[key] ??= ad.color[key]!;
  }
}

const shadows = Object.entries(tokens.shared.shadow).filter(([k]) => k !== "source");
const typeNames = Object.keys(rs.storefront.type).filter(
  (k) => typeof rs.storefront.type[k] !== "string",
);

const adLayout = ad.layout as Record<string, { value: number }>;

const css = `/* AUTO-GENERATED by scripts/tokens-to-css.ts from designs/tokens.json.
 * Do not edit by hand — edit designs/tokens.json and run \`pnpm tokens\`.
 * All values are inferred from the design PNGs / metadata (see designs/DESIGN.md). */

:root {
${colorVars(sf).join("\n")}
  --radius: ${px(sf.radius.base)};
${shadows.map(([k, v]) => `  --elevation-${k}: ${v};`).join("\n")}

  /* Responsive scale — mobile base, stepping up per layer. */
${layeredBlock(layeredVars(rs.storefront, rs.gutter))}
}

/* body:has(): portals (dialogs, popovers, sheets, toasts) mount on <body>,
   outside the admin wrapper, and must get the admin tokens too. */
.theme-admin,
body:has(.theme-admin) {
${colorVars(ad).join("\n")}
  --radius: ${px(ad.radius.base)};
  --font-sans: var(--font-admin);

${layeredBlock(layeredVars(rs.admin, rs.admin.gutter))}
}

@theme inline {
${extraColors.map((c) => `  --color-${c}: var(--${c});`).join("\n")}
${shadows.map(([k]) => `  --shadow-${k}: var(--elevation-${k});`).join("\n")}

  /* Type scale: text-display, text-h1 … text-caption (size + line-height + weight). */
${typeNames
  .map(
    (n) =>
      `  --text-${n}: var(--fs-${n});\n  --text-${n}--line-height: var(--lh-${n});\n  --text-${n}--font-weight: var(--fw-${n});`,
  )
  .join("\n")}

  /* Spacing: px-gutter, gap-section, py-section, … */
  --spacing-gutter: var(--gutter);
  --spacing-section: var(--section-gap);

  /* Container: max-w-page = 1320 design-px content + gutters (82.5rem; the laptop+ root scale sizes it). */
  --container-page: calc(${px(rs.container.shop.value)} + 2 * var(--gutter));
}

@theme {
  --container-shop: ${px(rs.container.shop.value)};
  --spacing-admin-sidebar: ${px(adLayout.sidebarOpen!.value)};
  --spacing-admin-sidebar-collapsed: ${px(adLayout.sidebarCollapsed!.value)};
  --spacing-admin-topbar: ${px(adLayout.topbarHeight!.value)};
}
`;

writeFileSync(resolve(root, "app/theme.css"), css);
console.log("✔ app/theme.css generated from designs/tokens.json");
