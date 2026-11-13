import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/callback-url";

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
 * - /account/** needs a session; /admin/** needs role ADMIN. Signed-out visitors go
 *   to /sign-in?callbackUrl=<where they were going>; signed-in customers on /admin go home.
 *
 * - /sign-in, /sign-up: signed-in users go to their callbackUrl (same-site only) or
 *   /account. Forgot/reset password stay reachable (a reset link works signed in too).
 *
 * This is the first line of defense only. The authoritative checks are
 * requireUser() / requireAdmin() in the account and admin layouts, and every
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

  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account/:path*",
    "/quick/:path*",
    "/sign-in",
    "/sign-up",
  ],
};
