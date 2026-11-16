import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { safeAdminCallbackUrl, safeCallbackUrl } from "@/lib/callback-url";

/**
 * Proxy (runs on the Node.js runtime).
 *
 * - /quick/[slug]: the Product Quick View URL. Soft navigations from a product card
 *   are router fetches and must reach the intercepted modal route, so they pass
 *   through. A direct load (shared link, reload, crawler) is a document
 *   request with nothing to float over: 307 to the product page. The page at
 *   app/(shop)/quick/[slug] redirects too, but under Cache Components that one
 *   streams (200 + meta refresh), so this gives a real HTTP redirect.
 *
 * - /product/[slug]: a renamed product's old slug (SlugRedirect) gets a real 308 to
 *   the current URL on page loads. The page redirects too, but it streams (200 +
 *   client redirect), which crawlers don't treat as a move. One indexed lookup.
 *
 * - /shop?category=<old-slug>: a renamed category's old slug (CATEGORY SlugRedirect)
 *   gets a 308 to the same URL with the current slug, for the same reason.
 *
 * - /account/** needs a session: signed-out visitors go to /sign-in?callbackUrl=….
 *
 * - /admin/** needs a STAFF or ADMIN session, except the admin auth pages
 *   (login, register, forgot/reset password). Anyone else, signed-in customers
 *   included, goes to /admin/login?callbackUrl=…. Staff already signed in skip
 *   /admin/login and /admin/register. Per-permission checks happen in the pages
 *   and in every admin action (lib/auth/permissions.ts).
 *
 * - /sign-in, /sign-up: signed-in users go to their callbackUrl (same-site only) or
 *   /account. Forgot/reset password stay reachable (a reset link works signed in too).
 *
 * This is the first line of defense only. The authoritative checks are
 * requireUser() / requireStaff() in the account and admin layouts, and every
 * server action re-checks the session itself.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (pathname.startsWith("/quick/")) {
    // Next strips its RSC headers before Proxy runs, so tell router fetches apart by
    // fetch metadata: page loads are `document`; router fetches/prefetches are `empty`.
    // No metadata at all (curl, crawlers) counts as a page load.
    const dest = request.headers.get("sec-fetch-dest");
    if (dest && dest !== "document") return NextResponse.next();
    const slug = pathname.slice("/quick/".length).split("/")[0] ?? "";
    return NextResponse.redirect(new URL(`/product/${slug}`, request.url), 307);
  }

  if (pathname.startsWith("/product/")) return productRedirect(request);

  if (pathname === "/shop") return categoryRedirect(request);

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(request);

  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  // Protected areas skip the signed cookie cache (one Session lookup), so a revoked
  // session (password reset, sign out elsewhere) gets an HTTP redirect at once.
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: !isAuthPage },
  });

  if (isAuthPage) {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(safeCallbackUrl(searchParams.get("callbackUrl")), request.url));
  }

  if (!session) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

async function productRedirect(request: NextRequest) {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return NextResponse.next(); // router fetches: the page handles it
  const slug = decodeURIComponent(request.nextUrl.pathname.slice("/product/".length).split("/")[0] ?? "");
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.next();
  const hit = await prisma.slugRedirect
    .findUnique({ where: { kind_fromSlug: { kind: "PRODUCT", fromSlug: slug } }, select: { product: { select: { slug: true, status: true } } } })
    .catch(() => null);
  const product = hit?.product;
  if (!product || product.status !== "PUBLISHED" || product.slug === slug) return NextResponse.next();
  const url = new URL(`/product/${product.slug}`, request.url);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url, 308);
}

async function categoryRedirect(request: NextRequest) {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return NextResponse.next(); // router fetches: the page handles it
  const slug = request.nextUrl.searchParams.get("category") ?? "";
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return NextResponse.next();
  const hit = await prisma.slugRedirect
    .findUnique({ where: { kind_fromSlug: { kind: "CATEGORY", fromSlug: slug } }, select: { category: { select: { slug: true } } } })
    .catch(() => null);
  const category = hit?.category;
  if (!category || category.slug === slug) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.searchParams.set("category", category.slug);
  url.searchParams.delete("page");
  return NextResponse.redirect(url, 308);
}

const ADMIN_PUBLIC = new Set(["/admin/login", "/admin/register", "/admin/forgot-password", "/admin/reset-password"]);
const ADMIN_SKIP_WHEN_SIGNED_IN = new Set(["/admin/login", "/admin/register"]);

async function adminGate(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const isPublic = ADMIN_PUBLIC.has(pathname);
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: !isPublic },
  });
  const staff = session && isStaffRole(session.user.role);

  if (isPublic) {
    if (staff && ADMIN_SKIP_WHEN_SIGNED_IN.has(pathname)) {
      return NextResponse.redirect(new URL(safeAdminCallbackUrl(searchParams.get("callbackUrl")), request.url));
    }
    return NextResponse.next();
  }
  if (!staff) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/quick/:path*",
    "/product/:path*",
    "/shop",
    "/sign-in",
    "/sign-up",
  ],
};
