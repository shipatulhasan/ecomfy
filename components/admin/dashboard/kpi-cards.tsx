import { InfoIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DateRange } from "@/lib/admin/date-range";
import { formatCountCompact, formatPriceCompact } from "@/lib/money";
import { getOrdersKpi, getPendingCanceledKpi, getSalesKpi } from "@/lib/queries/admin/dashboard";
import { DashCard } from "./dash-card";
import { RangeMenu } from "./range-menu";
import { TrendBadge } from "./trend";

/**
 * The three Dashboard.png counters (364×141): title + range label, value (32 bold)
 * with a trend on the right, and the previous period underneath. Each is its own
 * async component in its own Suspense boundary (app/admin/(panel)/page.tsx).
 */
function KpiShell({ title, range, children }: { title: React.ReactNode; range: DateRange; children: React.ReactNode }) {
  return (
    <DashCard className="flex min-h-35.25 flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-h2 text-foreground">{title}</h2>
        <RangeMenu current={range.key} label={range.label} from={range.from} to={range.to} />
      </div>
      <div className="mt-auto pt-4">{children}</div>
    </DashCard>
  );
}

export async function SalesCard({ range }: { range: DateRange }) {
  const kpi = await getSalesKpi(range);
  return (
    <KpiShell
      range={range}
      title={
        <>
          Total Sales
          <Tooltip>
            <TooltipTrigger aria-label="How revenue is counted" className="tap-target text-muted-foreground hover:text-foreground">
              <InfoIcon aria-hidden className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              Revenue counts paid orders only (payment status Paid), dated by when they were paid. Times are Asia/Dhaka.
            </TooltipContent>
          </Tooltip>
        </>
      }
    >
      <ValueRow value={formatPriceCompact(kpi.current)} unit="Sales" changePct={kpi.changePct} />
      <p className="mt-2 text-caption text-text-body">
        {range.prevLabel} <span className="font-bold text-info">({formatPriceCompact(kpi.previous)})</span>
      </p>
    </KpiShell>
  );
}

export async function OrdersCard({ range }: { range: DateRange }) {
  const kpi = await getOrdersKpi(range);
  return (
    <KpiShell range={range} title="Total Orders">
      <ValueRow value={formatCountCompact(kpi.current)} unit="order" changePct={kpi.changePct} />
      <p className="mt-2 text-caption text-text-body">
        {range.prevLabel} <span className="font-bold text-info">({formatCountCompact(kpi.previous)})</span>
      </p>
    </KpiShell>
  );
}

export async function PendingCanceledCard({ range }: { range: DateRange }) {
  const kpi = await getPendingCanceledKpi(range);
  return (
    <KpiShell range={range} title="Pending & Canceled">
      <div className="grid grid-cols-2 pb-2">
        <div className="pr-4">
          <p className="text-copy text-foreground">Pending</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-h1 font-bold text-foreground tabular-nums">{formatCountCompact(kpi.pending)}</span>
            <span className="text-copy text-success">user {formatCountCompact(kpi.pendingCustomers)}</span>
          </p>
        </div>
        <div className="border-l border-border pl-6">
          <p className="text-copy text-foreground">Canceled</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="text-h1 font-bold text-sale tabular-nums">{formatCountCompact(kpi.canceled.current)}</span>
            <TrendBadge changePct={kpi.canceled.changePct} />
          </p>
        </div>
      </div>
    </KpiShell>
  );
}

function ValueRow({ value, unit, changePct }: { value: string; unit: string; changePct: number | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <p className="text-display font-bold text-foreground tabular-nums">{value}</p>
      <p className="flex items-center gap-1 text-copy text-foreground">
        {unit} <TrendBadge changePct={changePct} />
      </p>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <DashCard className="flex min-h-35.25 flex-col gap-4" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-4 w-40" />
    </DashCard>
  );
}
