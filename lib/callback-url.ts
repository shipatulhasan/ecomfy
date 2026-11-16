/**
 * `?callbackUrl=` handling for sign-in / sign-up (e.g. checkout → sign in → back).
 * Only same-site paths are allowed: anything absolute, protocol-relative (`//x`),
 * backslash-tricked (`/\x`) or pointing back at an auth page falls back.
 * Safe to import from client and server code.
 */
export const AUTH_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/admin/login",
  "/admin/register",
  "/admin/forgot-password",
  "/admin/reset-password",
] as const;

export function safeCallbackUrl(raw: unknown, fallback = "/account"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, "http://local.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://local.invalid") return fallback;
  if (AUTH_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/sign-in?callbackUrl=…` (omits the param when it would be the default). */
export function signInHref(callbackUrl?: string | null, base: string = "/sign-in"): string {
  const cb = callbackUrl ? safeCallbackUrl(callbackUrl, "") : "";
  return cb && cb !== "/account" ? `${base}?callbackUrl=${encodeURIComponent(cb)}` : base;
}

/** Admin sign-in: same rules, and only back into the admin panel (else /admin). */
export function safeAdminCallbackUrl(raw: unknown): string {
  const url = safeCallbackUrl(raw, "/admin");
  return url === "/admin" || url.startsWith("/admin/") || url.startsWith("/admin?") ? url : "/admin";
}
