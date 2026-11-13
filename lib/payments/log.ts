import "server-only";

/**
 * Gateway logging without secrets. Every request/response goes through here:
 * printed with the provider tag and appended (redacted) to Payment.raw.
 */
const SECRET_KEYS =
  /^(password|passwd|store_passwd|app_secret|app_key|x-app-key|id_token|refresh_token|authorization|username|signature|verify_sign|verify_key|token)$/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return value;
}

export type LogEntry = { at: string; tag: string; event: string; data: unknown };

export function paymentLog(tag: string, event: string, data: unknown = {}): LogEntry {
  const entry: LogEntry = { at: new Date().toISOString(), tag, event, data: redact(data) };
  console.info(`${tag} ${event}`, JSON.stringify(entry.data));
  return entry;
}

export function paymentWarn(tag: string, event: string, data: unknown = {}): LogEntry {
  const entry: LogEntry = { at: new Date().toISOString(), tag, event, data: redact(data) };
  console.warn(`${tag} ${event}`, JSON.stringify(entry.data));
  return entry;
}
