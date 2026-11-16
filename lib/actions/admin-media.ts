"use server";

import { randomUUID } from "node:crypto";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { MediaItem } from "@/lib/admin/media";
import { inspectImage } from "@/lib/media/process";
import { DEFAULT_MAX_UPLOAD_MB, UPLOAD_MIME, UPLOAD_URL_TTL_SECONDS, isUploadMime } from "@/lib/media/upload-rules";
import { mediaUrl, publicUrl, storage, storageKeys } from "@/lib/storage";
import { confirmUploadSchema, mediaAltSchema, mediaIdsSchema, uploadRequestSchema } from "@/lib/validations/admin-product";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Product Media uploads, straight from the browser to Neon Object Storage:
 *   1. getUploadUrl: authorize, validate type + size, presign a PUT (5 min) with
 *      Content-Type and Content-Length signed (a PUT with any other type or
 *      length fails the signature: 403).
 *   2. the browser PUTs the file (progress, cancel, retry in the client).
 *   3. confirmUpload: HeadObject + read the real bytes with sharp; anything that
 *      isn't the declared image type is deleted. Creates the Media row.
 * The Next server never proxies file bytes from the client.
 */

async function maxUploadMb(): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { id: "default" }, select: { maxUploadMb: true } });
  return s?.maxUploadMb ?? DEFAULT_MAX_UPLOAD_MB;
}

/** Keep only a display name; it never becomes part of the object key. */
const displayName = (name: string) => name.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "image";

export async function getUploadUrl(input: unknown): Promise<ActionResult<{ key: string; url: string; maxMb: number }>> {
  return runAdminAction("products:write", uploadRequestSchema, input, async (data) => {
    const maxMb = await maxUploadMb();
    if (data.size > maxMb * 1024 * 1024) throw new ActionError(`Images must be ${maxMb} MB or smaller.`);
    const ext = UPLOAD_MIME[data.mime];
    const key = data.scope === "library" ? storageKeys.library(randomUUID(), ext) : storageKeys.tmp(randomUUID(), ext);
    const url = await storage.getUploadUrl(key, data.mime, data.size, UPLOAD_URL_TTL_SECONDS);
    return { key, url, maxMb };
  });
}

export async function confirmUpload(input: unknown): Promise<ActionResult<MediaItem>> {
  return runAdminAction("products:write", confirmUploadSchema, input, async (data, actor) => {
    const existing = await prisma.media.findUnique({ where: { key: data.key } });
    if (existing) return toItem(existing);

    const head = await storage.head(data.key);
    if (!head) throw new ActionError("The upload didn't arrive. Please retry.");

    const reject = async (msg: string): Promise<never> => {
      await storage.delete([data.key]).catch(() => {});
      throw new ActionError(msg);
    };
    const maxMb = await maxUploadMb();
    if (head.size <= 0 || head.size > maxMb * 1024 * 1024) await reject(`Images must be ${maxMb} MB or smaller.`);
    if (!head.mime || !isUploadMime(head.mime)) await reject("Only JPG, PNG, WebP or AVIF images.");
    // The extension in the key was chosen from the validated mime.
    const ext = data.key.split(".").pop();
    if (UPLOAD_MIME[head.mime as keyof typeof UPLOAD_MIME] !== ext) await reject("The file type changed during upload.");

    const info = await inspectImage(await storage.get(data.key));
    if (!info || info.mime !== head.mime) await reject("That file isn't a valid JPG, PNG, WebP or AVIF image.");

    const row = await prisma.$transaction(async (tx) => {
      const media = await tx.media.create({
        data: {
          key: data.key,
          url: publicUrl(data.key),
          originalName: displayName(data.fileName),
          mime: head.mime!,
          size: head.size,
          width: info!.width,
          height: info!.height,
          blurDataURL: info!.blurDataURL,
          uploadedById: actor.id,
        },
      });
      await logAudit(
        { actorId: actor.id, action: "media.upload", entity: "Media", entityId: media.id, after: { key: media.key, size: media.size, mime: media.mime } },
        tx,
      );
      return media;
    });
    return toItem(row);
  });
}

export async function updateMediaAlt(input: unknown): Promise<ActionResult<{ id: string; alt: string }>> {
  return runAdminAction("products:write", mediaAltSchema, input, async (data, actor) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.media.findUnique({ where: { id: data.id }, select: { alt: true } });
      if (!before) throw new ActionError("That image no longer exists.");
      await tx.media.update({ where: { id: data.id }, data: { alt: data.alt } });
      await logAudit({ actorId: actor.id, action: "media.alt", entity: "Media", entityId: data.id, before, after: { alt: data.alt } }, tx);
      return { id: data.id, alt: data.alt };
    });
  });
}

/**
 * Delete media (Product Media bulk delete / ✕). Blocked while any product or
 * variant still uses an image: detach it from the product first.
 */
export async function deleteMedia(input: unknown): Promise<ActionResult<{ deleted: number }>> {
  return runAdminAction("products:write", mediaIdsSchema, input, async (data, actor) => {
    const rows = await prisma.media.findMany({
      where: { id: { in: data.ids } },
      select: { id: true, key: true, originalName: true, productImages: { select: { product: { select: { name: true } } }, take: 1 } },
    });
    const inUse = rows.filter((r) => r.productImages.length > 0);
    if (inUse.length > 0) {
      const names = inUse.map((r) => `${r.originalName} (${r.productImages[0]!.product.name})`).slice(0, 3).join(", ");
      throw new ActionError(`Still used by a product: ${names}. Remove it from the product first.`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.media.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, productImages: { none: {} } } });
      await logAudit(
        { actorId: actor.id, action: "media.delete", entity: "Media", before: { ids: rows.map((r) => r.id), keys: rows.map((r) => r.key) } },
        tx,
      );
    });
    // Rows first, then objects: a failed object delete leaves an orphan, never a broken image.
    await storage.delete(rows.map((r) => r.key).filter((k) => !storageKeys.isLegacy(k))).catch((e) => console.error("[media] delete", e));
    return { deleted: rows.length };
  });
}

function toItem(m: {
  id: string;
  key: string;
  originalName: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  blurDataURL: string | null;
  createdAt: Date;
}): MediaItem {
  return {
    id: m.id,
    url: mediaUrl(m.key),
    originalName: m.originalName,
    mime: m.mime,
    size: m.size,
    width: m.width,
    height: m.height,
    alt: m.alt,
    blurDataURL: m.blurDataURL,
    createdAt: m.createdAt.toISOString(),
  };
}
