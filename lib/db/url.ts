/**
 * pg treats sslmode=prefer|require|verify-ca as verify-full today and warns on
 * every connection (the warning is forwarded to the browser console in dev).
 * Spell out the mode it already uses so the warning goes away and the behaviour
 * stays the same when pg v9 switches those modes to libpq semantics.
 * No "server-only": the seed and scripts use it too.
 */
export function pgConnectionString(raw: string | undefined): string | undefined {
  return raw?.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/, "$1verify-full");
}
