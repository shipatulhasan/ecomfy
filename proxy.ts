import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Proxy (runs on the Node.js runtime) for two prefixes:
 *
 * - /quick/[slug]: the Product Quick View URL. Soft navigations from a product card
 *   are router fetches and must reach the intercepted modal route, so they pass
 *   through. A direct load (shared link, reload, crawler) is a document
 *   request with nothing to float over: 307 to the product page. The page at
 *   app/(shop)/quick/[slug] redirects too, but under Cache Components that one
 *   streams (200 + meta refresh), so this gives a real HTTP redirect.
 *
 * - /admin: first line of defense. The authoritative check is requireAdmin() in
 *   app/admin/layout.tsx, and every admin server action must call requireAdmin()
 *   itself — Proxy coverage is not enough on its own.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/quick/")) {
    // Next strips its RSC headers before Proxy runs, so tell router fetches apart by
    // fetch metadata: page loads are `document`; router fetches/prefetches are `empty`.
    // No metadata at all (curl, crawlers) counts as a page load.
    const dest = request.headers.get("sec-fetch-dest");
    if (dest && dest !== "document") return NextResponse.next();
    const slug = pathname.slice("/quick/".length).split("/")[0] ?? "";
    return NextResponse.redirect(new URL(`/product/${slug}`, request.url), 307);
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/quick/:path*"],
};
