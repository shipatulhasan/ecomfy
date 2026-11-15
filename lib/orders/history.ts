import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export type StatusActor = "customer" | "admin" | "system";

/**
 * Append one OrderStatusHistory row. Call it in the same transaction as the status
 * update, and only when that update actually changed the row (conditional updates
 * that matched 0 rows must not write history). The Order Details tracker reads the
 * dates from here (lib/queries/orders.ts).
 */
export async function recordStatus(
  tx: Prisma.TransactionClient,
  orderId: string,
  status: OrderStatus,
  note: string | null = null,
  actor: StatusActor = "system",
) {
  await tx.orderStatusHistory.create({ data: { orderId, status, note, actor } });
}
