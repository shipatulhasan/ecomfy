"use server";

import { prisma } from "@/lib/db";
import { newsletterSchema } from "@/lib/validations/newsletter";
import type { ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Newsletter sign-up. Public by design (no session needed). Idempotent upsert so
 * the response never reveals whether an address was already subscribed.
 * Used with useActionState: (previous state, FormData).
 */
export async function subscribeNewsletter(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  return runAction(newsletterSchema, { email: formData.get("email") }, async ({ email }) => {
    await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
    return null;
  });
}
