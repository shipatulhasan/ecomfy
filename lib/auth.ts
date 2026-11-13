import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { CART_COOKIE } from "@/lib/cart-cookie";
import { mergeGuestIntoUser } from "@/lib/cart/merge";
import { prisma } from "@/lib/db";
import { parseWishlistCookie, WISHLIST_COOKIE } from "@/lib/wishlist-cookie";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Google is enabled only when credentials are configured, so local dev works without them.
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  session: {
    // Sessions live in the DB (Session table). The signed cookie cache avoids a
    // DB round-trip on every request for 5 minutes; role changes apply after that.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      role: {
        type: ["CUSTOMER", "ADMIN"],
        defaultValue: "CUSTOMER",
        input: false, // never settable from sign-up payloads
      },
    },
  },
  hooks: {
    // Guest cart + wishlist → the account, right after a session is created by
    // sign-in or sign-up (email or social callback). Then the guest cookies go.
    after: createAuthMiddleware(async (ctx) => {
      const userId = ctx.context.newSession?.user.id;
      if (!userId || !/^\/(sign-in|sign-up|callback)\//.test(ctx.path)) return;
      const guestToken = ctx.getCookie(CART_COOKIE);
      const guestWishlist = parseWishlistCookie(ctx.getCookie(WISHLIST_COOKIE));
      if (!guestToken && guestWishlist.length === 0) return;
      try {
        await mergeGuestIntoUser(userId, guestToken, guestWishlist);
      } catch (err) {
        // Never fail the sign-in over the merge; the guest cart stays in its cookie.
        console.error("[auth] guest cart merge failed", err);
        return;
      }
      if (guestToken) ctx.setCookie(CART_COOKIE, "", { path: "/", maxAge: 0 });
      if (guestWishlist.length > 0) ctx.setCookie(WISHLIST_COOKIE, "", { path: "/", maxAge: 0 });
    }),
  },
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
