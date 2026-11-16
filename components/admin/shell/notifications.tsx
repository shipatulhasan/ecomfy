"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Bell (Dashboard.png) with a red dot while orders wait for the admin. */
export function Notifications({ codToConfirm, awaitingPayment }: { codToConfirm: number; awaitingPayment: number }) {
  const total = codToConfirm + awaitingPayment;
  const items = [
    { n: codToConfirm, text: "Cash on delivery orders to confirm", href: "/admin/orders?status=PENDING_CONFIRMATION" },
    { n: awaitingPayment, text: "Orders waiting for online payment", href: "/admin/orders?status=PENDING_PAYMENT" },
  ].filter((i) => i.n > 0);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={total ? `Notifications, ${total} pending` : "Notifications"}
        className="tap-target relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:text-primary"
      >
        <BellIcon aria-hidden className="size-6" strokeWidth={1.75} />
        {total > 0 && <span aria-hidden className="absolute top-2 right-2.5 size-2 rounded-full bg-sale ring-2 ring-muted" />}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-h4 text-foreground">Notifications</p>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-copy text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="py-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex items-center gap-3 px-4 py-3 text-copy text-text-body hover:bg-secondary">
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-sale px-1.5 text-caption font-bold text-destructive-foreground">
                    {i.n}
                  </span>
                  {i.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
