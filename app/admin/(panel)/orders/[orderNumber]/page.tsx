import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminOrderDetailView } from "@/components/admin/orders/detail/order-detail";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getAdminOrderDetail } from "@/lib/queries/admin/orders";
import { orderNumberSchema } from "@/lib/validations/orders";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

/**
 * Admin order detail (no design; see designs/DESIGN.md → Order detail). Accepts
 * "1042" or "ECF-001042". Request-time only (customer PII, never cached).
 */
export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[orderNumber]">) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <Gate params={params} />
    </Suspense>
  );
}

async function Gate({ params }: Pick<PageProps<"/admin/orders/[orderNumber]">, "params">) {
  const { orderNumber } = await params;
  const user = await requireStaff(`/admin/orders/${encodeURIComponent(orderNumber)}`);
  if (!can(user, "orders:read")) return <Forbidden />;
  const parsed = orderNumberSchema.safeParse(decodeURIComponent(orderNumber));
  if (!parsed.success) notFound();
  const order = await getAdminOrderDetail(parsed.data);
  if (!order) notFound();

  return (
    <Container variant="admin" className="py-5">
      <AdminOrderDetailView order={order} canUpdate={can(user, "orders:update")} canRefund={can(user, "orders:refund")} />
    </Container>
  );
}

function OrderDetailSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex flex-col gap-5 laptop:grid laptop:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </Container>
  );
}
