import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/shell/coming-soon";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Order" };

/** Admin order detail (dashboard + search link here). Placeholder until Order Management is built. */
export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const user = await requireStaff();
  if (!can(user, "orders:read")) return <Forbidden />;
  return (
    <ComingSoon
      title={`Order #${decodeURIComponent(orderNumber).replace(/[^\w-]/g, "").slice(0, 20)}`}
      detail="Order details are coming soon with Order Management."
    />
  );
}
