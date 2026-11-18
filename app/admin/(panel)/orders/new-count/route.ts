import { connection } from "next/server";
import { ActionError } from "@/lib/actions/result";
import { countOrdersSince } from "@/lib/queries/admin/orders";

/**
 * Order Management "N new orders" pill: how many orders were placed after
 * `?since=` (the list's render time). orders:read; per user, never cached.
 */
export async function GET(request: Request) {
  await connection();
  const since = new URL(request.url).searchParams.get("since") ?? "";
  try {
    const count = await countOrdersSince(since);
    return Response.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof ActionError) return Response.json({ count: 0 }, { status: 403 });
    throw err;
  }
}
