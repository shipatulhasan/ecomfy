import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDhaka } from "@/lib/admin/date-range";
import type { PaymentStatus } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/orders/status";
import { getRecentTransactions, type TxFilter } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader, SeeMore } from "./dash-card";
import { FilterMenu } from "./filter-menu";

const TX_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
];

/** Payment status as the PNG shows it: colored dot + word. */
const PAY: Record<PaymentStatus, { label: string; dot: string }> = {
  PAID: { label: "Paid", dot: "bg-success" },
  UNPAID: { label: "Pending", dot: "bg-warning" },
  FAILED: { label: "Failed", dot: "bg-sale" },
  REFUNDED: { label: "Refunded", dot: "bg-muted-foreground" },
};

export function PayStatus({ status, className }: { status: PaymentStatus; className?: string }) {
  const s = PAY[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-copy text-foreground", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

/**
 * "Transaction" (1139×382): the latest 5 orders with their payment status.
 * Table from tablet (scrolls inside the card if needed); cards on mobile.
 * Order numbers link to /admin/orders/[number].
 */
export async function Transactions({ filter }: { filter: TxFilter }) {
  const rows = await getRecentTransactions(filter);
  return (
    <DashCard aria-labelledby="tx-title">
      <DashCardHeader
        titleId="tx-title"
        title="Transaction"
        action={<FilterMenu param="tx" label="Payment status" options={TX_OPTIONS} value={filter} />}
      />
      {rows.length === 0 ? (
        <p className="mt-6 text-copy text-muted-foreground">No orders yet.</p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto tablet:block">
            <table className="w-full min-w-160 text-left text-copy">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="h-8.25 w-[18%] px-6 font-normal">No</th>
                  <th scope="col" className="w-[24%] font-normal">Id Customer</th>
                  <th scope="col" className="w-[27%] font-normal">Order Date</th>
                  <th scope="col" className="w-[22%] font-normal">Status</th>
                  <th scope="col" className="font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.number} className="h-11.25 text-foreground">
                    <td className="px-6">{i + 1}.</td>
                    <td>
                      <Link href={`/admin/orders/${r.number}`} className="hover:text-primary hover:underline" title={r.customer}>
                        #{r.number}
                      </Link>
                    </td>
                    <td>{formatDhaka(r.createdAt, "dd MMM | h:mm a")}</td>
                    <td>
                      <PayStatus status={r.paymentStatus} />
                    </td>
                    <td>{formatPrice(r.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 flex flex-col gap-3 tablet:hidden">
            {rows.map((r) => (
              <li key={r.number}>
                <Link
                  href={`/admin/orders/${r.number}`}
                  className="press flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <span className="min-w-0">
                    <span className="block font-bold text-foreground">#{r.number}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {formatDhaka(r.createdAt, "dd MMM | h:mm a")} · {paymentMethodLabel(r.paymentMethod)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-foreground">{formatPrice(r.totalCents)}</span>
                    <PayStatus status={r.paymentStatus} className="text-caption" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 flex justify-end">
        <SeeMore href="/admin/transactions" />
      </div>
    </DashCard>
  );
}

export function TransactionsSkeleton() {
  return (
    <DashCard className="flex flex-col gap-4" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </DashCard>
  );
}
