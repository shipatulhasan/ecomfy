"use server";

import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guards";
import { AVATAR_ROUTE, avatarDir, avatarFileFromUrl } from "@/lib/avatars";
import { prisma } from "@/lib/db";
import { addressSchema } from "@/lib/validations/address";
import { changePasswordSchema, profileSchema } from "@/lib/validations/auth";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Settings (designs/screens/web/Settings.png): Account Settings (+ avatar),
 * Billing Address, Change Password. Every action re-checks the session itself.
 *
 * Name and image go through Better Auth's updateUser so the session cookie cache
 * (lib/auth.ts) picks the change up at once; phone and address are app fields.
 */
type FormState = ActionResult<{ message: string }> | null;

const fields = (fd: FormData, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]));

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(profileSchema, fields(fd, ["firstName", "lastName", "phone"]), async (data) => {
    const user = await requireUser();
    const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
    await auth.api.updateUser({ body: { name }, headers: await headers() });
    await prisma.user.update({ where: { id: user.id }, data: { phone: data.phone || null } });
    refresh();
    return { message: "Profile saved." };
  });
}

const ADDRESS_KEYS = ["firstName", "lastName", "companyName", "street", "city", "district", "zip", "email", "phone"] as const;

export async function saveBillingAddressAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(addressSchema, fields(fd, ADDRESS_KEYS), async (data) => {
    const user = await requireUser();
    const existing = await prisma.address.findFirst({
      where: { userId: user.id, kind: "BILLING" },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
    });
    const row = { ...data, companyName: data.companyName ?? null };
    if (existing) {
      await prisma.address.update({ where: { id: existing.id }, data: { ...row, isDefault: true } });
    } else {
      await prisma.address.create({ data: { ...row, userId: user.id, kind: "BILLING", isDefault: true } });
    }
    refresh();
    return { message: "Billing address saved." };
  });
}

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    changePasswordSchema,
    fields(fd, ["currentPassword", "newPassword", "confirmPassword"]),
    async ({ currentPassword, newPassword }) => {
      await requireUser();
      try {
        // Signs out every other device; this one gets a fresh session cookie.
        await auth.api.changePassword({
          body: { currentPassword, newPassword, revokeOtherSessions: true },
          headers: await headers(),
        });
      } catch (err) {
        if (err instanceof APIError) {
          // Google-only accounts have no password to check against.
          throw new ActionError("Current password is incorrect.");
        }
        throw err;
      }
      return { message: "Password changed. Other devices have been signed out." };
    },
  );
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const avatarSchema = z.object({
  file: z
    .instanceof(File, { error: "Choose an image" })
    .refine((f) => f.size > 0, "Choose an image")
    .refine((f) => f.size <= MAX_AVATAR_BYTES, "The image must be 2 MB or smaller")
    .refine((f) => ["image/png", "image/jpeg", "image/webp"].includes(f.type), "Use a PNG, JPG or WebP image"),
});

/**
 * "Choose Image": resized to a 256×256 WebP (re-encoding also strips metadata and
 * anything that isn't a real image) and stored on disk (lib/avatars.ts).
 */
export async function uploadAvatarAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(avatarSchema, { file: fd.get("avatar") }, async ({ file }) => {
    const user = await requireUser();
    let webp: Buffer;
    try {
      webp = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(256, 256, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new ActionError("That file isn't an image we can read.");
    }
    const hash = createHash("sha256").update(webp).digest("hex").slice(0, 16);
    const name = `${user.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${hash}.webp`;
    const dir = avatarDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), webp);

    const previous = avatarFileFromUrl(user.image);
    await auth.api.updateUser({ body: { image: `${AVATAR_ROUTE}/${name}` }, headers: await headers() });
    if (previous && previous !== name) await unlink(path.join(dir, previous)).catch(() => {});
    refresh();
    return { message: "Photo updated." };
  });
}
