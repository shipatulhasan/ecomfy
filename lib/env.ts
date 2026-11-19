import "server-only";
import { z } from "zod";

/**
 * Server env, parsed lazily per concern so a missing gateway key only breaks that
 * gateway (and is reported where it's used), never the whole app.
 * Values are never logged.
 */
function parse<T extends z.ZodType>(name: string, schema: T): z.infer<T> {
  const res = schema.safeParse(process.env);
  if (!res.success) {
    const keys = res.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`[env] ${name}: missing or invalid ${keys} (see .env.example)`);
  }
  return res.data;
}

const once = <T,>(fn: () => T) => {
  let v: T | undefined;
  return () => (v ??= fn());
};

/**
 * Public origin used to build gateway callback URLs. Gateways call back from the
 * internet, so in production it must be https (locally: a tunnel, see README).
 */
export const appEnv = once(() => {
  const env = parse(
    "app",
    z.object({
      APP_URL: z.url().optional(),
      SITE_URL: z.url().optional(),
      BETTER_AUTH_URL: z.url().optional(),
    }),
  );
  const raw = env.APP_URL ?? env.SITE_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return { appUrl: new URL(raw) };
});

/** Bearer secret for /api/cron/* (null = cron endpoints disabled). */
export const cronSecret = once(() => {
  const v = process.env.CRON_SECRET;
  return v && v.length >= 16 ? v : null;
});

/** Absolute URL on APP_URL (browser redirects after a callback). */
export const appUrl = (path: string) => new URL(path, appEnv().appUrl).toString();

/**
 * URL a gateway calls back (success / fail / cancel / IPN / bKash callback).
 * Gateways reach it from the internet, so in production it must be https. It
 * throws otherwise, which fails only that payment start (the customer lands on
 * "Try again / Change method").
 */
export function gatewayCallbackUrl(path: string): string {
  const url = new URL(path, appEnv().appUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("[env] app: APP_URL must be a public https URL in production (payment callbacks)");
  }
  return url.toString();
}

export const bkashEnv = once(() =>
  parse(
    "bkash",
    z.object({
      // e.g. https://tokenized.sandbox.bka.sh/v2/tokenized-checkout (no trailing slash)
      BKASH_BASE_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
      BKASH_APP_KEY: z.string().min(1),
      BKASH_APP_SECRET: z.string().min(1),
      BKASH_USERNAME: z.string().min(1),
      BKASH_PASSWORD: z.string().min(1),
    }),
  ),
);

export const sslczEnv = once(() => {
  const env = parse(
    "sslcommerz",
    z.object({
      SSLCZ_STORE_ID: z.string().min(1),
      SSLCZ_STORE_PASSWORD: z.string().min(1),
      SSLCZ_IS_LIVE: z
        .enum(["true", "false", "1", "0"])
        .optional()
        .transform((v) => v === "true" || v === "1"),
    }),
  );
  const host = env.SSLCZ_IS_LIVE ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
  return {
    storeId: env.SSLCZ_STORE_ID,
    storePassword: env.SSLCZ_STORE_PASSWORD,
    isLive: env.SSLCZ_IS_LIVE,
    sessionUrl: `${host}/gwprocess/v4/api.php`,
    validationUrl: `${host}/validator/api/validationserverAPI.php`,
    /** Transaction Query API by tran_id (reconciliation). */
    transactionQueryUrl: `${host}/validator/api/merchantTransIDvalidationAPI.php`,
  };
});
