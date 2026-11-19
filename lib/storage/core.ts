import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Neon Object Storage (S3-compatible, path-style only). This file has no
 * "server-only" marker so seed/scripts can import it; app code imports
 * `@/lib/storage`, which re-exports it behind "server-only". Credentials come
 * from the four AWS_* variables Neon injects and never reach the client.
 *
 * Only operations Neon documents are used: PutObject (incl. presigned PUT),
 * HeadObject, GetObject, CopyObject, DeleteObjects, ListObjectsV2. ACL headers
 * are never sent (Neon answers 501).
 */

/** Neon injects no bucket variable; the branch has one bucket, named "uploads" (public_read). */
export const BUCKET = "uploads";

/** Every object we write is content-addressed by a uuid key, so it never changes. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

export type StoredObject = { key: string; size: number; mime: string | null; lastModified: Date | null };

export interface Storage {
  /** Presigned PUT; Content-Type and Content-Length are signed, so the browser must send exactly these. */
  getUploadUrl(key: string, mime: string, size: number, expiresIn?: number): Promise<string>;
  head(key: string): Promise<StoredObject | null>;
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, mime: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  delete(keys: string[]): Promise<void>;
  list(prefix: string): AsyncGenerator<StoredObject>;
  publicUrl(key: string): string;
}

function endpoint(): string {
  const v = process.env.AWS_ENDPOINT_URL_S3;
  if (!v) throw new Error("[storage] AWS_ENDPOINT_URL_S3 is not set (see README → Storage)");
  return v.replace(/\/+$/, "");
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (client) return client;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error("[storage] AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not set");
  client = new S3Client({
    endpoint: endpoint(),
    region: process.env.AWS_REGION || "auto",
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Neon supports path-style addressing only
  });
  return client;
}

const notFound = (e: unknown) =>
  e instanceof NotFound || (e instanceof S3ServiceException && (e.$metadata.httpStatusCode === 404 || e.name === "NoSuchKey"));

/** Public URL of an object: path-style on the branch endpoint. */
export function publicUrl(key: string): string {
  return `${endpoint()}/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export const neonStorage: Storage = {
  async getUploadUrl(key, mime, size, expiresIn = 300) {
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: mime, ContentLength: size, CacheControl: IMMUTABLE });
    return getSignedUrl(s3(), cmd, {
      expiresIn,
      // Sign these so a PUT with another type/length fails the signature check.
      signableHeaders: new Set(["content-type", "content-length", "cache-control"]),
    });
  },

  async head(key) {
    try {
      const r = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return { key, size: r.ContentLength ?? 0, mime: r.ContentType ?? null, lastModified: r.LastModified ?? null };
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  },

  async get(key) {
    const r = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!r.Body) throw new Error(`[storage] empty body for ${key}`);
    return Buffer.from(await r.Body.transformToByteArray());
  },

  async put(key, body, mime) {
    await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: mime, CacheControl: IMMUTABLE }));
  },

  async copy(from, to) {
    await s3().send(
      new CopyObjectCommand({ Bucket: BUCKET, Key: to, CopySource: `${BUCKET}/${from.split("/").map(encodeURIComponent).join("/")}` }),
    );
  },

  async delete(keys) {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      if (chunk.length === 0) continue;
      await s3().send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
    }
  },

  async *list(prefix) {
    let token: string | undefined;
    do {
      const r = await s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }));
      for (const o of r.Contents ?? []) {
        if (o.Key) yield { key: o.Key, size: o.Size ?? 0, mime: null, lastModified: o.LastModified ?? null };
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
  },

  publicUrl,
};

/** Key layout. Never contains the original file name. */
export const storageKeys = {
  tmp: (uuid: string, ext: string) => `tmp/${uuid}.${ext}`,
  library: (uuid: string, ext: string) => `media/${uuid}.${ext}`,
  product: (productId: string, uuid: string, ext: string) => `products/${productId}/${uuid}.${ext}`,
  category: (categoryId: string, uuid: string, ext: string) => `categories/${categoryId}/${uuid}.${ext}`,
  /** Admin General Info → profile photo (re-encoded 256×256 WebP). */
  avatar: (userId: string, uuid: string) => `avatars/${userId}/${uuid}.webp`,
  /** Admin Settings → Store logo / favicon, SEO OG image. */
  store: (purpose: "logo" | "favicon" | "og", uuid: string, ext: string) => `store/${purpose}-${uuid}.${ext}`,
  isTmp: (key: string) => key.startsWith("tmp/"),
  /** Legacy rows (pre-storage seed) keep a site-relative "/seed/…" key. */
  isLegacy: (key: string) => key.startsWith("/"),
};

/** URL to render a Media row: legacy keys are site paths, the rest live in the bucket. */
export function mediaUrl(key: string): string {
  return storageKeys.isLegacy(key) ? key : publicUrl(key);
}
