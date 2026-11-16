import "server-only";

/**
 * Storage behind a small interface so the provider can be swapped later.
 * App code imports from here; scripts/seed import `./core` directly.
 */
export { neonStorage as storage, storageKeys, mediaUrl, publicUrl, BUCKET } from "./core";
export type { Storage, StoredObject } from "./core";
