import "server-only";

/**
 * Absolute origin for metadata (metadataBase → canonical URLs) and JSON-LD.
 * SITE_URL in production; falls back to the auth URL (same origin in dev).
 */
export const siteUrl = new URL(process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000");

export const absoluteUrl = (path: string) => new URL(path, siteUrl).toString();
