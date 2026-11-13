import "server-only";
import { prisma } from "@/lib/db";
import { gatewayCallbackUrl, bkashEnv } from "@/lib/env";
import { fromTaka, toTakaString } from "@/lib/money";
import { paymentLog, paymentWarn, type LogEntry } from "./log";
import { appendPaymentLog, markFailed, markPaid, recordGatewaySession } from "./state";
import type { CallbackResult, PaymentProvider } from "./types";

/**
 * bKash Tokenized Checkout, direct (never through SSLCommerz).
 * Docs: developer.bka.sh → Tokenized Checkout v2
 *   POST {base}/auth/grant-token     headers username/password; body app_key, app_secret
 *   POST {base}/auth/refresh-token   + refresh_token
 *   POST {base}/payment/create       → paymentId, bkashURL
 *   POST {base}/payment/execute      → trxId, transactionStatus "Completed"
 *   POST {base}/query/payment        → transactionStatus, trxId, merchantInvoice
 * Callback: GET {callbackURL}?paymentID=…&status=success|failure|cancel&signature=…
 *
 * Grant Token is limited to 2 calls/hour, so the token lives in the DB
 * (GatewayToken) and is refreshed ~5 minutes before expiry by any instance.
 */
const TAG = "[bkash]";
const TIMEOUT_MS = 30_000; // bKash API timeout
const REFRESH_EARLY_MS = 5 * 60_000;

type BkashJson = Record<string, unknown>;

/** v2 responses use paymentId/trxId; older docs paymentID/trxID. Accept both. */
const pick = (o: BkashJson, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
};

class BkashError extends Error {
  constructor(message: string, public timeout = false) {
    super(message);
  }
}

async function call(path: string, body: unknown, headers: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<BkashJson> {
  const { BKASH_BASE_URL } = bkashEnv();
  let res: Response;
  try {
    res = await fetch(`${BKASH_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new BkashError(`${path}: ${timeout ? "timeout" : String(err)}`, timeout);
  }
  const json = (await res.json().catch(() => ({}))) as BkashJson;
  if (!res.ok) throw new BkashError(`${path}: HTTP ${res.status} ${pick(json, "errorMessageEn", "statusMessage") ?? ""}`);
  return json;
}

/** bKash errors come back as 200 with statusCode / externalCode ≠ 0000. */
function errorOf(json: BkashJson): string | null {
  const code = pick(json, "statusCode", "externalCode");
  if (code && code !== "0000") return `${code} ${pick(json, "errorMessageEn", "statusMessage") ?? ""}`.trim();
  return null;
}

// ───────────────────────────── token ─────────────────────────────

async function grantToken(): Promise<{ idToken: string; refreshToken: string; expiresIn: number }> {
  const env = bkashEnv();
  const json = await call(
    "/auth/grant-token",
    { app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET },
    { username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD },
  );
  paymentLog(TAG, "grant-token", { statusCode: json.statusCode, expires_in: json.expires_in });
  return parseToken(json);
}

async function refreshToken(token: string) {
  const env = bkashEnv();
  const json = await call(
    "/auth/refresh-token",
    { app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET, refresh_token: token },
    { username: env.BKASH_USERNAME, password: env.BKASH_PASSWORD },
  );
  paymentLog(TAG, "refresh-token", { statusCode: json.statusCode, expires_in: json.expires_in });
  return parseToken(json);
}

function parseToken(json: BkashJson) {
  const err = errorOf(json);
  const idToken = pick(json, "id_token");
  const refresh = pick(json, "refresh_token");
  if (err || !idToken || !refresh) throw new BkashError(`token: ${err ?? "no id_token"}`);
  return { idToken, refreshToken: refresh, expiresIn: Number(json.expires_in ?? 3600) || 3600 };
}

async function getToken(): Promise<string> {
  const row = await prisma.gatewayToken.findUnique({ where: { provider: "bkash" } });
  if (row && row.expiresAt.getTime() - REFRESH_EARLY_MS > Date.now()) return row.idToken;

  let next;
  try {
    next = row ? await refreshToken(row.refreshToken) : await grantToken();
  } catch (err) {
    if (!row) throw err;
    paymentWarn(TAG, "refresh-failed-regrant", { error: String(err) });
    next = await grantToken();
  }
  const expiresAt = new Date(Date.now() + next.expiresIn * 1000);
  await prisma.gatewayToken.upsert({
    where: { provider: "bkash" },
    create: { provider: "bkash", idToken: next.idToken, refreshToken: next.refreshToken, expiresAt },
    update: { idToken: next.idToken, refreshToken: next.refreshToken, expiresAt },
  });
  return next.idToken;
}

async function authed(path: string, body: unknown, timeoutMs?: number) {
  const token = await getToken();
  return call(path, body, { Authorization: token, "X-App-Key": bkashEnv().BKASH_APP_KEY }, timeoutMs);
}

// ───────────────────────────── API ─────────────────────────────

const executeTimeout = () =>
  // Dev-only switch to exercise the "execute timed out → query" path in the sandbox.
  process.env.NODE_ENV !== "production" && process.env.BKASH_SIMULATE_EXECUTE_TIMEOUT === "1" ? 1 : TIMEOUT_MS;

async function executePayment(paymentId: string) {
  return authed("/payment/execute", { paymentId, paymentID: paymentId }, executeTimeout());
}

async function queryPayment(paymentId: string) {
  return authed("/query/payment", { paymentId, paymentID: paymentId });
}

// ───────────────────────────── provider ─────────────────────────────

export const bkash: PaymentProvider = {
  method: "BKASH",
  tag: TAG,
  isEnabled: (s) => s.bkashEnabled,

  async start(order, attempt) {
    const request = {
      mode: "0011", // tokenized checkout without agreement
      payerReference: order.phone,
      callbackURL: gatewayCallbackUrl("/api/payments/bkash/callback"),
      amount: toTakaString(attempt.amountCents),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: attempt.reference,
    };
    const json = await authed("/payment/create", request);
    const log = paymentLog(TAG, "create", { request, response: json });
    const err = errorOf(json);
    const paymentId = pick(json, "paymentId", "paymentID");
    const url = pick(json, "bkashURL", "bKashURL");
    if (err || !paymentId || !url) {
      await appendPaymentLog(attempt.id, log);
      throw new BkashError(`create: ${err ?? "no bkashURL"}`);
    }
    await recordGatewaySession(attempt.id, { paymentId }, log);
    return { redirectUrl: url };
  },
};

/**
 * The callback route (app/api/payments/bkash/callback). Never trusts `status`
 * alone: success is confirmed by Execute (or Query) with amount + invoice checks.
 */
export async function handleBkashCallback(params: URLSearchParams): Promise<CallbackResult> {
  const paymentId = params.get("paymentID") ?? params.get("paymentId") ?? "";
  const status = params.get("status") ?? "";
  const attempt = paymentId
    ? await prisma.payment.findUnique({
        where: { paymentId },
        select: { id: true, reference: true, amountCents: true, status: true, orderId: true, order: { select: { paymentStatus: true } } },
      })
    : null;
  if (!attempt) {
    paymentWarn(TAG, "callback-unknown", { paymentId, status });
    return { outcome: "invalid", orderId: null, reason: "Unknown bKash payment" };
  }
  const received = paymentLog(TAG, "callback", { paymentId, status, reference: attempt.reference });

  // Duplicate callback: the attempt is already final.
  if (attempt.status !== "INITIATED" && attempt.status !== "PENDING") {
    await appendPaymentLog(attempt.id, received, paymentLog(TAG, "callback-duplicate", { status: attempt.status }));
    return { outcome: "noop", orderId: attempt.orderId, paid: attempt.order.paymentStatus === "PAID" };
  }

  if (status === "cancel") return markFailed(attempt.reference, "cancelled", "Cancelled at bKash", TAG, [received]);
  if (status !== "success") return markFailed(attempt.reference, "failed", "Payment failed at bKash", TAG, [received]);

  const log: LogEntry[] = [received];
  let result: BkashJson | null = null;
  try {
    result = await executePayment(paymentId);
    log.push(paymentLog(TAG, "execute", { response: result }));
    if (errorOf(result) || pick(result, "transactionStatus") !== "Completed") {
      // An execute error can still mean "already completed" (e.g. 2062): ask Query.
      result = null;
    }
  } catch (err) {
    log.push(paymentWarn(TAG, "execute-error", { error: String(err), timeout: err instanceof BkashError && err.timeout }));
  }

  if (!result) {
    try {
      const q = await queryPayment(paymentId);
      log.push(paymentLog(TAG, "query", { response: q }));
      const tx = pick(q, "transactionStatus");
      if (tx === "Completed") result = q;
      else if (tx === "Initiated" || errorOf(q)) {
        return markFailed(attempt.reference, "failed", "bKash payment was not completed", TAG, log);
      } else {
        // Unknown / in-flight state: leave the attempt pending (expiry job or a later query settles it).
        await appendPaymentLog(attempt.id, ...log);
        return { outcome: "pending", orderId: attempt.orderId };
      }
    } catch (err) {
      log.push(paymentWarn(TAG, "query-error", { error: String(err) }));
      await appendPaymentLog(attempt.id, ...log);
      return { outcome: "pending", orderId: attempt.orderId };
    }
  }

  // Verify what bKash says was paid matches this order attempt.
  const amount = fromTaka(pick(result, "amount") ?? "");
  const invoice = pick(result, "merchantInvoiceNumber", "merchantInvoice");
  const currency = pick(result, "currency") ?? "BDT";
  if (amount !== attempt.amountCents || invoice !== attempt.reference || currency !== "BDT") {
    log.push(
      paymentWarn(TAG, "mismatch", { amount, expected: attempt.amountCents, invoice, reference: attempt.reference, currency }),
    );
    return markFailed(attempt.reference, "failed", "bKash amount or invoice mismatch", TAG, log);
  }
  return markPaid(attempt.reference, { trxId: pick(result, "trxId", "trxID") ?? null }, TAG, log);
}
