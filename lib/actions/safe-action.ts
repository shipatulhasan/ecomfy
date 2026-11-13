import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ActionError, type ActionResult } from "./result";

/**
 * Validate `input` with `schema`, run `fn`, and wrap the outcome in an ActionResult.
 *
 *   export async function createCategory(input: unknown) {
 *     "use server";
 *     return runAction(categorySchema, input, async (data) => {
 *       await requireAdmin();
 *       const row = await prisma.category.create({ data });
 *       updateTag(CacheTags.categories);
 *       return row;
 *     });
 *   }
 *
 * Authorization belongs inside `fn` — every action re-checks the session.
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
