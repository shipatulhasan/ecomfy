import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { gatewayCallbackUrl, sslczEnv } from "@/lib/env";
import { fromTaka, toTakaString } from "@/lib/money";
import { paymentLog, paymentWarn, type LogEntry } from "./log";
import { appendPaymentLog, markFailed, markPaid, recordGatewaySession } from "./state";
import type { CallbackResult, GatewayAnswer, PaymentProvider } from "./types";

/**
 * SSLCommerz v4: cards and online banking (bKash is offered directly, so it's
 * excluded from this gateway).
 * Docs: developer.sslcommerz.com/doc/v4/
 *   Session:    POST {host}/gwprocess/v4/api.php (form) → status SUCCESS, GatewayPageURL, sessionkey
 *   Validation: GET  {host}/validator/api/validationserverAPI.php?val_id&store_id&store_passwd&format=json
 *               → status VALID | VALIDATED | INVALID_TRANSACTION, tran_id, currency_type, currency_amount, …
 * Callbacks POST form data to success / fail / cancel / ipn (Route Handlers).
 * The success redirect is never trusted alone: paid only after the Validation API.
 */
const TAG = "[sslcz]";
const TIMEOUT_MS = 30_000;

/**
 * Gateway restriction (`multi_card_name`): card groups + internet banking, no
 * mobile banking group (that's where bKash lives). The docs list the field as
 * 30 chars; keep this short and re-check the gateway page in the sandbox.
 */
export const SSLCZ_CHANNELS = "visacard,mastercard,amexcard,internetbank";

type Fields = Record<string, string>;

async function post(url: string, form: Fields): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ status: "FAILED", failedreason: `HTTP ${res.status}` }))) as Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const clip = (v: string, n: number) => v.slice(0, n);

export const sslcommerz: PaymentProvider = {
  method: "SSLCOMMERZ",
  tag: TAG,
  isEnabled: (s) => s.sslcommerzEnabled,

  async start(order, attempt) {
    const env = sslczEnv();
    const b = order.billing;
    const s = order.shipping;
    const units = order.items.reduce((n, i) => n + i.quantity, 0);
    const form: Fields = {
      store_id: env.storeId,
      store_passwd: env.storePassword,
      total_amount: toTakaString(attempt.amountCents),
      currency: "BDT",
      tran_id: attempt.reference,
      success_url: gatewayCallbackUrl("/api/payments/sslcommerz/success"),
      fail_url: gatewayCallbackUrl("/api/payments/sslcommerz/fail"),
      cancel_url: gatewayCallbackUrl("/api/payments/sslcommerz/cancel"),
      ipn_url: gatewayCallbackUrl("/api/payments/sslcommerz/ipn"),
      multi_card_name: SSLCZ_CHANNELS,
      // Customer
      cus_name: clip(`${b.firstName} ${b.lastName}`, 50),
      cus_email: clip(order.email, 50),
      cus_add1: clip(b.street, 50),
      cus_city: clip(b.city, 50),
      cus_state: clip(b.district, 50),
      cus_postcode: b.zip,
      cus_country: "Bangladesh",
      cus_phone: order.phone,
      // Shipping
      shipping_method: "Courier",
      num_of_item: String(units),
      ship_name: clip(`${s.firstName} ${s.lastName}`, 50),
      ship_add1: clip(s.street, 50),
      ship_city: clip(s.city, 50),
      ship_state: clip(s.district, 50),
      ship_postcode: s.zip,
      ship_country: "Bangladesh",
      // Product
      product_name: clip(order.items.map((i) => i.productName).join(", ") || "Groceries", 255),
      product_category: "Groceries",
      product_profile: "physical-goods",
      value_a: order.id,
    };
    const json = await post(env.sessionUrl, form);
    const log = paymentLog(TAG, "session", {
      request: form,
      response: { status: json.status, failedreason: json.failedreason, sessionkey: json.sessionkey, GatewayPageURL: json.GatewayPageURL },
    });
    const url = str(json.GatewayPageURL);
    if (str(json.status) !== "SUCCESS" || !url) {
      await appendPaymentLog(attempt.id, log);
      throw new Error(`session: ${str(json.failedreason) || "no GatewayPageURL"}`);
    }
    await recordGatewaySession(attempt.id, { sessionKey: str(json.sessionkey) }, log);
    return { redirectUrl: url };
  },
};

// ───────────────────────────── callbacks ─────────────────────────────

/**
 * IPN / callback integrity (SSLCommerz `verify_sign`): md5 over the fields named
 * in `verify_key` plus md5(store_passwd), sorted by key, joined as k=v&k=v.
 */
export function verifySign(fields: Fields): boolean {
  const sign = fields.verify_sign;
  const keys = fields.verify_key?.split(",").filter(Boolean);
  if (!sign || !keys?.length) return false;
  const data: Fields = {};
  for (const k of keys) data[k] = fields[k] ?? "";
  data.store_passwd = createHash("md5").update(sslczEnv().storePassword).digest("hex");
  const hashString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("&");
  const expected = Buffer.from(createHash("md5").update(hashString).digest("hex"));
  const given = Buffer.from(sign);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function validate(valId: string): Promise<Record<string, unknown>> {
  const env = sslczEnv();
  const url = new URL(env.validationUrl);
  url.search = new URLSearchParams({
    val_id: valId,
    store_id: env.storeId,
    store_passwd: env.storePassword,
    format: "json",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Transaction Query API by tran_id (reconciliation, lib/payments/reconcile.ts):
 *   GET {host}/validator/api/merchantTransIDvalidationAPI.php?tran_id&store_id&store_passwd&format=json
 *   → { APIConnect: "DONE", no_of_trans_found, element: [{ status, val_id, amount, store_amount, … }] }
 */
export async function queryByTranId(tranId: string): Promise<Record<string, unknown>> {
  const env = sslczEnv();
  const url = new URL(env.transactionQueryUrl);
  url.search = new URLSearchParams({
    tran_id: tranId,
    store_id: env.storeId,
    store_passwd: env.storePassword,
    format: "json",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  return (await res.json()) as Record<string, unknown>;
}

/** Fee + card details from a validation / query element (stored on the Payment row). */
export function sslczExtras(v: Record<string, unknown>) {
  const amount = fromTaka(str(v.amount));
  const net = fromTaka(str(v.store_amount));
  const fee = Number.isFinite(amount) && Number.isFinite(net) && amount >= net ? amount - net : null;
  return {
    feeCents: fee,
    cardBrand: str(v.card_brand) || str(v.card_type) || null,
    cardIssuer: str(v.card_issuer) || null,
  };
}

export type SslczKind = "success" | "fail" | "cancel" | "ipn";

/**
 * One handler for all four routes. success / ipn: validate val_id with the
 * Validation API, then check tran_id, amount and currency against the attempt.
 * Whichever of redirect and IPN arrives first marks the order; the other is a no-op.
 */
export async function handleSslczCallback(kind: SslczKind, fields: Fields): Promise<CallbackResult> {
  const tranId = fields.tran_id ?? "";
  const attempt = tranId
    ? await prisma.payment.findUnique({
        where: { reference: tranId },
        select: { id: true, reference: true, amountCents: true, currency: true, status: true, orderId: true, method: true, order: { select: { paymentStatus: true } } },
      })
    : null;
  if (!attempt || attempt.method !== "SSLCOMMERZ") {
    paymentWarn(TAG, `${kind}-unknown`, { tran_id: tranId, status: fields.status });
    return { outcome: "invalid", orderId: null, reason: "Unknown transaction" };
  }
  const log: LogEntry[] = [
    paymentLog(TAG, kind, {
      tran_id: tranId,
      status: fields.status,
      val_id: fields.val_id,
      amount: fields.amount,
      currency_type: fields.currency_type,
      bank_tran_id: fields.bank_tran_id,
      card_type: fields.card_type,
      risk_level: fields.risk_level,
      error: fields.error,
    }),
  ];

  const isFinal = attempt.status !== "INITIATED" && attempt.status !== "PENDING";
  const gatewaySaysValid = fields.status === "VALID" || fields.status === "VALIDATED";

  if (kind === "fail" || kind === "cancel" || (kind === "ipn" && !gatewaySaysValid)) {
    if (isFinal) {
      await appendPaymentLog(attempt.id, ...log, paymentLog(TAG, "duplicate", { status: attempt.status }));
      return { outcome: "noop", orderId: attempt.orderId, paid: attempt.order.paymentStatus === "PAID" };
    }
    // Only a signed post may fail an order (tran_ids are guessable).
    if (!verifySign(fields)) {
      await appendPaymentLog(attempt.id, ...log, paymentWarn(TAG, "bad-signature", { kind }));
      return { outcome: "invalid", orderId: attempt.orderId, reason: "Signature check failed" };
    }
    const cancelled = kind === "cancel" || fields.status === "CANCELLED";
    return markFailed(
      attempt.reference,
      cancelled ? "cancelled" : "failed",
      cancelled ? "Cancelled at the payment page" : str(fields.error) || "Payment failed",
      TAG,
      log,
    );
  }

  // success / IPN VALID
  if (attempt.status === "SUCCEEDED") {
    await appendPaymentLog(attempt.id, ...log, paymentLog(TAG, "duplicate", { status: attempt.status }));
    return { outcome: "noop", orderId: attempt.orderId, paid: true };
  }
  const valId = fields.val_id;
  if (!valId) {
    await appendPaymentLog(attempt.id, ...log, paymentWarn(TAG, "no-val-id", {}));
    return { outcome: "pending", orderId: attempt.orderId };
  }

  let v: Record<string, unknown>;
  try {
    v = await validate(valId);
  } catch (err) {
    // Validation API down: don't decide; the IPN (or a later redirect) retries.
    await appendPaymentLog(attempt.id, ...log, paymentWarn(TAG, "validate-error", { error: String(err) }));
    return { outcome: "pending", orderId: attempt.orderId };
  }
  log.push(
    paymentLog(TAG, "validate", {
      status: v.status,
      tran_id: v.tran_id,
      val_id: v.val_id,
      amount: v.amount,
      currency_type: v.currency_type,
      currency_amount: v.currency_amount,
      store_amount: v.store_amount,
      bank_tran_id: v.bank_tran_id,
      card_type: v.card_type,
      card_brand: v.card_brand,
      card_issuer: v.card_issuer,
      risk_level: v.risk_level,
      risk_title: v.risk_title,
    }),
  );

  const status = str(v.status);
  const ok =
    (status === "VALID" || status === "VALIDATED") &&
    str(v.tran_id) === attempt.reference &&
    str(v.currency_type) === "BDT" &&
    fromTaka(str(v.currency_amount)) === attempt.amountCents &&
    fromTaka(str(v.amount)) === attempt.amountCents;
  if (!ok) {
    if (status === "INVALID_TRANSACTION" || (status && status !== "VALID" && status !== "VALIDATED")) {
      return markFailed(attempt.reference, "failed", "Payment could not be validated", TAG, log);
    }
    log.push(paymentWarn(TAG, "mismatch", { expected: attempt.amountCents, reference: attempt.reference }));
    return markFailed(attempt.reference, "failed", "Amount or transaction mismatch", TAG, log);
  }
  if (str(v.risk_level) === "1") log.push(paymentWarn(TAG, "risky", { risk_title: v.risk_title, action: "review before shipping" }));

  return markPaid(attempt.reference, { valId, bankTranId: str(v.bank_tran_id) || null, ...sslczExtras(v) }, TAG, log);
}

/** Reconciliation: what SSLCommerz says about this tran_id now (Transaction Query API). */
export async function sslczGatewayAnswer(tranId: string): Promise<GatewayAnswer> {
  const json = await queryByTranId(tranId);
  const elements = Array.isArray(json.element) ? (json.element as Record<string, unknown>[]) : [];
  const response = {
    APIConnect: json.APIConnect,
    no_of_trans_found: json.no_of_trans_found,
    element: elements.map((e) => ({
      status: e.status,
      tran_id: e.tran_id,
      val_id: e.val_id,
      amount: e.amount,
      store_amount: e.store_amount,
      currency: e.currency,
      currency_type: e.currency_type,
      currency_amount: e.currency_amount,
      bank_tran_id: e.bank_tran_id,
      card_type: e.card_type,
      card_brand: e.card_brand,
      card_issuer: e.card_issuer,
      tran_date: e.tran_date,
      risk_level: e.risk_level,
    })),
  };
  const empty = { amountCents: null, currency: null, reference: null, ids: {}, response };
  if (str(json.APIConnect) !== "DONE") return { ...empty, state: "unknown", status: str(json.APIConnect) || "no answer" };
  if (!elements.length) return { ...empty, state: "pending", abandoned: true, status: "no transaction" };

  const valid = elements.find((e) => str(e.status) === "VALID" || str(e.status) === "VALIDATED");
  const e = valid ?? elements[0] ?? {};
  const status = str(e.status);
  const answer = {
    status,
    amountCents: fromTaka(str(e.currency_amount) || str(e.amount)),
    currency: str(e.currency_type) || str(e.currency) || null,
    reference: str(e.tran_id) || null,
    ids: { valId: str(e.val_id) || null, bankTranId: str(e.bank_tran_id) || null, ...sslczExtras(e) },
    response,
  };
  if (valid) return { ...answer, state: "paid" };
  if (/^(FAILED|CANCELLED|EXPIRED|INVALID_TRANSACTION)$/.test(status)) return { ...answer, state: "failed" };
  if (status === "UNATTEMPTED") return { ...answer, state: "pending", abandoned: true };
  return { ...answer, state: "pending" };
}
