import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

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
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
