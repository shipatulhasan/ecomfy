import "server-only";

/** Google sign-in is offered only when its OAuth credentials are configured (lib/auth.ts). */
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
