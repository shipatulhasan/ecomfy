@AGENTS.md

# Ecomfy

Grocery e-commerce: a storefront plus an admin panel.
Stack: Next.js 16 (App Router, Turbopack, Cache Components), TypeScript strict, Tailwind v4, shadcn/ui (Radix, Nova), Prisma 7 + PostgreSQL (Neon), Better Auth, zod 4, pnpm.

## Design data

Never call Figma MCP tools in this project. All design data lives in /designs.

- Start from `designs/DESIGN.md`. It covers the screen inventory, tokens, fonts, icons and the component map.
- `designs/screens/{web,admin}/*.png` are the visual reference. Use `designs/raw/metadata.xml` for exact sizes and positions.
- `designs/tokens.json` is the only place colors are defined. Edit it, then run `pnpm tokens` to regenerate `app/theme.css`.
- Never edit `app/theme.css` by hand.

## Project rules

- **Server Components by default.** Add `"use client"` only to small interactive leaves (quantity stepper, carousel, forms), never to pages or layouts.
- **Mutations:**
  - All mutations are server actions in `lib/actions/`.
  - Validate input with a zod schema from `lib/validations/` using `runAction()` (`lib/actions/safe-action.ts`).
  - Return a typed `ActionResult<T>` (`lib/actions/result.ts`).
  - Every action re-checks auth itself (`requireUser()` / `requireAdmin()`). Never rely on the proxy or a layout for authorization.
- **Catalog reads:**
  - Catalog reads live in `lib/queries/` and use `"use cache"` + `cacheTag(...)` + `cacheLife(...)`, with tags from `lib/cache-tags.ts`.
  - Admin mutations invalidate with `updateTag(tag)` inside server actions (read-your-own-writes). Use `revalidateTag(tag, "max")` from route handlers.
  - Never read `cookies()`/`headers()`/the session inside `"use cache"`. Resolve the user first and pass `user.id` in.
- **Suspense:** wrap slow or request-time sections (session, cart, per-user data) in `<Suspense>` with a skeleton (`components/ui/skeleton`). With Cache Components, request-time reads outside `<Suspense>` are a build error.
- **Images:**
  - Use `next/image` for every image.
  - Seed images are real crops from the design PNGs, listed in `designs/assets/manifest.json` (URL + width/height) and served from `/seed/**`.
  - `pnpm db:seed` copies `designs/assets` → `public/seed`. `pnpm assets:crop` regenerates the crops.
  - Banners (hero, promo, discount) are in the manifest's `banners` group for the Home page.
- **No hard-coded colors:**
  - No hex values in app code. Use token utilities (`bg-primary`, `text-brand-dark`, `bg-sale-soft`, …).
  - Enforced by `pnpm lint` (`scripts/check-design-rules.ts`).
  - The admin theme is applied by the `.theme-admin` class (`app/admin/layout.tsx`).
- **Money** is integer cents in the DB and in code. Display it with `formatPrice()` (`lib/money.ts`).
- **Auth:**
  - Better Auth lives in `lib/auth.ts` (server) and `lib/auth-client.ts` (client). Session helpers are in `lib/auth-guards.ts`.
  - `/admin` is guarded by `proxy.ts` and by `requireAdmin()` in `app/admin/layout.tsx`.
- **Prisma:** the client is generated to `lib/generated/prisma` (gitignored). Import it from `@/lib/db` in app code.
- **Next.js 16 APIs differ from older versions.** Check `node_modules/next/dist/docs/` before using an API: the middleware file is `proxy.ts`, `revalidateTag` takes 2 arguments, and `forbidden()` is still experimental.

## Responsive rules (every screen)

The system is defined in `app/globals.css` and `designs/tokens.json`. The per-screen layer decisions live in `designs/DESIGN.md` → Responsive system.

### Four layers, mobile-first

| Layer | Width | Prefix |
|---|---|---|
| mobile | < 768px | none (base styles) |
| tablet | 768–1023px | `tablet:` |
| laptop | 1024–1439px | `laptop:` |
| desktop | ≥ 1440px | `desktop:` |

- **Only use `tablet:` / `laptop:` / `desktop:`.** Never `sm:`/`md:`/`lg:`/`xl:`/`2xl:`, `max-*:` or `min-[…]:`.
  - `pnpm lint` fails on them.
  - Tailwind's defaults stay defined only for the vendored `components/ui`.
- **Fluid root scale (storefront, laptop+):**
  - Laptop and desktop are one layout: the 1920 desktop PNG scaled down. From 1024px `html` font-size is `clamp(12px, 100vw / 120, 16px)` (`app/globals.css`): 12px from 1024 to 1440, then fluid up to 16px at 1920 and above. Mobile/tablet and the admin (`.theme-admin`) stay at 16px.
  - Never use px for layout, spacing or type on laptop/desktop components; use rem so the root scale works. Only borders/hairlines (0–2px) and shadows stay in px. `pnpm lint` fails on px arbitrary values and on `w-screen`/`100vw` in classes.
  - No separate laptop values: storefront code sets laptop+ once with `laptop:` and doesn't use `desktop:`. Column counts and line breaks match at every laptop/desktop width.
  - `next/image` `sizes` for laptop+ boxes: `laptopSizes(designPx)` from `lib/image-sizes.ts`.
  - No `w-screen`/`100vw`/fixed `min-w-*`; full-bleed means the full width of the parent. `body { overflow-x: clip }` is only a safety net.
- **Container:**
  - Wrap page content in `<Container>` (`components/shared/container.tsx`). Never hand-roll `max-w-*`/`px-*` page wrappers.
  - Storefront gutters per layer are 24 / 24 / 16 / 16 design-px (admin: 24 / 24 / 32 / 32) (`px-safe-gutter`: `px-gutter` that also clears landscape notches).
  - `variant="shop"` caps content at 82.5rem (1320 design-px) with auto margins, exactly the Figma width.
  - `variant="admin"` is fluid beside the sidebar.
- **Desktop matches the desktop PNG exactly.** Tablet and mobile follow their PNGs where one exists. The only one is the admin mobile auth frames, at 430 wide.
- **Layers with no design:** derive them, and record the decision in `designs/DESIGN.md` → "Per-screen layer decisions" in the same change.
- **Grids** reflow per layer.
  - Product grid: 2 / 3 / 5 / 5 (Home) or 2 / 3 / 4 / 4 (Product 4x).
  - Categories: 3 / 4 / 6 / 6.
  - Horizontal lists (Home sections, chips, logos) are rails below laptop and grids from laptop (see App shell).
  - Full table in DESIGN.md.
- **No horizontal page scroll at any width.** Wide tables scroll inside their own `overflow-x-auto` wrapper, never the page.
- **Tap targets ≥ 44px on mobile/tablet:**
  - shadcn controls get this automatically: `globals.css` sets a min-height on their `data-slot`s below laptop.
  - Custom links and icon buttons use the `tap-target` utility.
  - Checkboxes, radios and switches sit inside a `<Label>`.
- **Header:** full 3-row nav on laptop/desktop. On tablet/mobile it's a compact sticky app bar (logo, search icon, cart) plus the bottom tab bar. There's no hamburger.
- **Filters:** sidebar on laptop/desktop; bottom sheet (`BottomSheet`) below.
- **Account nav** follows the same pattern. The **admin sidebar** keeps the shadcn Sidebar `Sheet` (admin isn't part of the app shell).
- **Type and spacing come from the responsive tokens.** They step down per layer automatically:
  - Type: `text-display`, `text-h1`…`text-h4`, `text-lead`, `text-copy`, `text-caption`.
  - Spacing: `gap-section` / `py-section` / `px-gutter`.
  - Don't stack `text-*` breakpoint overrides for headings; change the scale in `tokens.json`.
- **CSS-only responsiveness:**
  - No JS width detection for layout (`matchMedia`, `innerWidth`, `useIsMobile`…); `pnpm lint` fails on it.
  - Show/hide with `hidden laptop:flex` / `laptop:hidden`.
  - The one exception is the vendored shadcn Sidebar's `hooks/use-mobile.ts`, which switches to a Sheet below 1024px.
- **`next/image`:** give `sizes` per layer, e.g. `sizes="(width >= 64rem) 264px, (width >= 48rem) 33vw, 50vw"`.

## App shell (below laptop, every storefront screen)

Below 1024px the storefront behaves like a native app. Laptop and desktop follow the PNGs exactly, and **app patterns never leak up**: every one of them is `laptop:hidden`, reset with `laptop:`, or scoped below laptop in `globals.css`.

- **Bottom tab bar** (`components/shop/mobile/bottom-nav.tsx`):
  - Tabs: Home, Shop, Search, Cart (optimistic badge), Account.
  - Visible on every shop page. It hides itself while a text field has focus (CSS) and isn't rendered on `/checkout*`.
  - New tab-level routes go in its `tabs` list. Focused flows go in `HIDDEN_ON`.
- **Bottom sheets, not modals or side panels:**
  - Filters, sort, variant pickers and the mini cart use `BottomSheet` (`components/shared/bottom-sheet.tsx`, vaul Drawer with a drag handle).
  - Anything that's a side `Sheet` or `Dialog` on laptop uses `AdaptiveSheet` (bottom sheet below, right sheet above).
- **Rails for horizontal lists:**
  - Use `<Rail>`/`<RailItem>` (`components/shared/rail.tsx`): pure CSS scroll-snap, edge-to-edge bleed, the next item peeks.
  - `laptop="grid"` turns it into the PNG grid from laptop. Products use `ProductRail`.
  - Never add a carousel JS library for this.
- **Sticky primary action:**
  - The screen's main action (PDP "Add to cart", cart "Checkout") sits in `StickyActionBar` (`components/shared/sticky-action-bar.tsx`) above the tab bar.
  - List toolbars (filter + sort) are `sticky top-(--app-header-h)` under the header.
- **Fixed/sticky elements and safe areas:**
  - Position with the app-shell variables in `app/globals.css`, never raw offsets:
    - `--app-header-h`: sticky header height, including the top inset;
    - `--app-bottom-nav`: tab bar height, including the bottom inset; 0 when it's hidden or absent;
    - `--app-bottom-safe`: the bottom inset not already covered.
  - Example: `bottom-(--app-bottom-nav) pb-(--app-bottom-safe)`.
  - `body` is already padded for the tab bar. Side insets: `px-safe-gutter`.
- **Touch feel:**
  - `press` on tappables (scale .97 below laptop). Cards use `press-card` with `data-slot="card-link"` on the stretched link.
  - shadcn buttons get it automatically.
  - No hover-only interactions: anything revealed on hover is always visible below laptop.
  - Tap highlight and double-tap zoom are off globally.
- **Loading:** skeletons, never spinners. `pnpm lint` fails on `animate-spin` / `Loader*Icon`.
- **Page transitions:**
  - Wrap each `page.tsx`'s content in `<PageTransition>` (`components/shared/page-transition.tsx`), not the layout.
  - Drill-down links get `transitionTypes={["nav-forward"]}`, back links `["nav-back"]`, tabs fade.
  - CSS only, off from laptop and for `prefers-reduced-motion`.
- **PWA:**
  - `app/manifest.ts` and the `viewport` export in `app/layout.tsx` (`viewport-fit=cover`, token theme color).
  - Icons are generated by `pnpm icons`. Colors come from `designs/tokens.json` via `lib/config/pwa.ts`.
  - No service worker yet.

## Folders

- `app/(shop)`: storefront.
- `app/(auth)`: sign-in / sign-up.
- `app/(account)`: customer account, which requires a session.
- `app/admin`: admin panel.
- `components/ui`: shadcn primitives. Vendored: add with `pnpm dlx shadcn@latest add <name>` and don't hand-edit.
- `components/shop`, `components/admin`, `components/shared`: custom components (see `designs/DESIGN.md`).
- `lib/db`, `lib/actions`, `lib/validations`, `lib/queries`.
- `prisma/`, `scripts/`.

## Commands

`pnpm dev` · `pnpm build` · `pnpm lint` (ESLint + design rules) · `pnpm lint:design` · `pnpm typecheck` · `pnpm tokens` · `pnpm assets:crop` · `pnpm icons` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:studio`
