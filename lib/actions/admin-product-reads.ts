"use server";

import { z } from "zod";
import type { MediaItem } from "@/lib/admin/media";
import { listMedia, searchProductsForAdd } from "@/lib/queries/admin/products";
import type { ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Read-only server functions for client pickers in the product form (media
 * library sheet, "Search product for add"). They authorize like any admin
 * action (products:read) and never mutate.
 */

const browseSchema = z.object({ q: z.string().max(100).default(""), page: z.number().int().min(1).max(1000).default(1) });

export async function browseMedia(input: unknown): Promise<ActionResult<{ items: MediaItem[]; pages: number }>> {
  return runAdminAction("products:read", browseSchema, input, async ({ q, page }) => {
    const r = await listMedia({ q, used: null, page });
    return { items: r.items, pages: r.pages };
  });
}

export async function findProducts(input: unknown) {
  return runAdminAction("products:read", z.object({ q: z.string().max(100) }), input, ({ q }) => searchProductsForAdd(q));
}
