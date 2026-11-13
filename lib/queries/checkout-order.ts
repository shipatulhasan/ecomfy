import "server-only";
import { canAccessOrder } from "@/lib/checkout/order-access";
import { prisma } from "@/lib/db";
import { expireStale } from "@/lib/payments/state";

/**
 * The order behind /checkout/success and /checkout/failed, only for its owner
 * (session or the browser that placed it). Request-time, never cached. Reading
 * is side-effect free apart from settling an overdue PENDING_PAYMENT → EXPIRED,
 * so refreshing these pages is always safe.
 */
export async function getCheckoutOrder(id: string | undefined) {
  if (!id || id.length > 40) return null;
  const head = await prisma.order.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!head || !(await canAccessOrder(head))) return null;
  await expireStale({ orderId: id });

  return prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      codFeeCents: true,
      totalCents: true,
      couponCode: true,
      district: true,
      shippingZoneName: true,
      deliveryEstimate: true,
      userId: true,
      items: {
        select: { id: true, productName: true, variantName: true, imageUrl: true, quantity: true, subtotalCents: true },
      },
      payments: {
        orderBy: { attempt: "desc" },
        take: 1,
        select: { status: true, trxId: true, bankTranId: true, failReason: true, method: true },
      },
    },
  });
}

export type CheckoutOrder = NonNullable<Awaited<ReturnType<typeof getCheckoutOrder>>>;
