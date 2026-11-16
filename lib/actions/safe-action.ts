import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import type { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth-guards";
import { ActionError, type ActionResult } from "./result";

/**
 * Validate `input` with `schema`, run `fn`, and wrap the outcome in an ActionResult.
 *
 *   export async function updateProfile(input: unknown) {
 *     "use server";
 *     return runAction(profileSchema, input, async (data) => {
 *       const user = await requireUser();
 *       …
 *     });
 *   }
 *
 * Authorization belongs inside `fn` — every action re-checks the session.
 * Admin actions use runAdminAction() below instead (authorize, then validate).
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }

  try {
    return { ok: true, data: await fn(parsed.data) };
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() propagate
    if (err instanceof ActionError) return { ok: false, error: err.message };
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Admin server actions: authorize FIRST (staff session + `permission`), then
 * validate, then run. A staff member without the permission gets
 * `{ ok: false, error: FORBIDDEN }` whatever they send; no session → admin login.
 * Every admin mutation must also call logAudit() (lib/audit.ts).
 *
 *   export async function createCoupon(_prev, fd: FormData) {
 *     return runAdminAction("coupons:write", couponSchema, fields(fd), async (data, actor) => { … });
 *   }
 */
export async function runAdminAction<S extends z.ZodType, T>(
  permission: Permission,
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>, actor: SessionUser) => Promise<T>,
): Promise<ActionResult<T>> {
  let actor: SessionUser;
  try {
    actor = await requirePermission(permission);
  } catch (err) {
    unstable_rethrow(err); // redirect to /admin/login
    if (err instanceof ActionError) return { ok: false, error: err.message };
    throw err;
  }
  return runAction(schema, input, (data) => fn(data, actor));
}
