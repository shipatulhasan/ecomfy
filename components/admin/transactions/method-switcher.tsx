"use client";

import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { METHOD_LABELS } from "@/lib/admin/orders/params";
import { paymentMethodMeta } from "@/lib/config/checkout";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { formatMoneyWhole } from "@/lib/money";
import type { MethodStat } from "@/lib/queries/admin/transactions";
import { cn } from "@/lib/utils";

const GATEWAY: Record<PaymentMethod, { name: string; settles: string }> = {
  BKASH: { name: "bKash Tokenized", settles: "Instant" },
  SSLCOMMERZ: { name: "SSLCommerz", settles: "Instant" },
  COD: { name: "Courier cash", settles: "On delivery" },
};

const METHOD_PARAM: Record<PaymentMethod, string> = { BKASH: "bkash", SSLCOMMERZ: "sslcommerz", COD: "cod" };

/**
 * The Payment Method box body: card art + stats per method, method tabs below
 * (where the PNG has "Add Card"). Side by side once the box is 20rem wide
 * (container query: the box width depends on the sidebar, not the viewport).
 */
export function MethodSwitcher({ methods }: { methods: MethodStat[] }) {
  return (
    <Tabs defaultValue={methods[0]?.method} className="mt-4 flex flex-1 flex-col gap-4 laptop:mt-5">
      {methods.map((m) => (
        <TabsContent key={m.method} value={m.method} className="flex flex-none flex-col gap-4 @xs:flex-row @xs:items-center">
          <CardArt m={m} />
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-lead text-text-body @xs:grid-cols-1 @xs:gap-y-3.5">
            <div>
              <dt className="inline">Status: </dt>
              <dd className={cn("inline font-medium", m.enabled ? "text-success" : "text-sale")}>{m.enabled ? "Active" : "Disabled"}</dd>
            </div>
            <div>
              <dt className="inline">Transactions: </dt>
              <dd className="inline font-medium text-foreground tabular-nums">{m.count.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="inline">Revenue: </dt>
              <dd className="inline font-bold text-foreground tabular-nums">{formatMoneyWhole(m.netCents)}</dd>
            </div>
            <div>
              <Link
                href={`/admin/transactions?method=${METHOD_PARAM[m.method]}`}
                scroll={false}
                className="tap-target inline-flex items-center text-info hover:underline"
              >
                View Transactions
              </Link>
            </div>
          </dl>
        </TabsContent>
      ))}
      <TabsList aria-label="Payment method" className="mt-auto grid h-10 w-full grid-cols-3 rounded-lg border border-border bg-card p-1 group-data-horizontal/tabs:h-10">
        {methods.map((m) => (
          <TabsTrigger key={m.method} value={m.method} className="h-full rounded-md text-copy data-[state=active]:bg-secondary data-[state=active]:text-primary data-[state=active]:shadow-none">
            {METHOD_LABELS[m.method]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Transaction.png card art (260 × 164): token gradient, method logo, status pill, gateway + settlement. */
function CardArt({ m }: { m: MethodStat }) {
  const meta = paymentMethodMeta[m.method];
  return (
    <div className="relative aspect-[260/164] w-full max-w-80 shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-primary via-success to-success-soft p-4 text-primary-foreground shadow-sm @xs:w-[58%]">
      {/* Decorative facets, as in the PNG's card. */}
      <span aria-hidden className="absolute -top-1/3 -right-1/4 h-full w-2/3 rotate-30 bg-primary-foreground/10" />
      <span aria-hidden className="absolute -bottom-1/2 -left-1/4 h-full w-3/4 -rotate-30 bg-foreground/15" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className="grid h-7 w-14 place-items-center rounded-md bg-card px-1.5">
            <Image src={meta.logo} alt={meta.logoAlt} width={56} height={28} unoptimized className="max-h-5 w-auto" />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium",
              m.enabled ? "bg-primary-foreground/90 text-primary" : "bg-foreground/40 text-primary-foreground",
            )}
          >
            <span aria-hidden className={cn("size-2 rounded-full", m.enabled ? "bg-success" : "bg-sale")} />
            {m.enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-h3 font-bold tracking-wide">{meta.label}</p>
        <div className="flex items-end justify-between gap-2 text-caption">
          <span className="min-w-0">
            <span className="block opacity-80">Gateway</span>
            <span className="block truncate font-bold">{GATEWAY[m.method].name}</span>
          </span>
          <span className="text-right">
            <span className="block opacity-80">Settles</span>
            <span className="block font-bold">{GATEWAY[m.method].settles}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
