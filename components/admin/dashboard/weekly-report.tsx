import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { dhakaDateKey, type WeekKey } from "@/lib/admin/date-range";
import { getWeeklyReport } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader } from "./dash-card";
import { WeeklyReportTabs } from "./weekly-report-tabs";

/**
 * "Report for this week" (749×457): This week / Last week switch (?week=last),
 * five stat tabs (Customers, Total Products, Stock Products, Out of Stock, Revenue)
 * and the Sun–Sat area chart. Customers and Revenue drive the chart; the product
 * tabs are current catalog counts and link to the Product List.
 */
export async function WeeklyReport({ week, query }: { week: WeekKey; query: Record<string, string> }) {
  const report = await getWeeklyReport(week);
  const href = (w: WeekKey) => {
    const p = new URLSearchParams(query);
    if (w === "this") p.delete("week");
    else p.set("week", w);
    const qs = p.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };
  return (
    <DashCard aria-labelledby="report-title" className="flex flex-col">
      <DashCardHeader
        titleId="report-title"
        title={week === "this" ? "Report for this week" : "Report for last week"}
        action={
          <nav aria-label="Report week" className="flex shrink-0 rounded-lg bg-secondary p-1">
            {(["this", "last"] as const).map((w) => (
              <Link
                key={w}
                href={href(w)}
                scroll={false}
                replace
                aria-current={week === w ? "true" : undefined}
                className={cn(
                  "tap-target rounded-md px-3 py-1.5 text-caption transition-colors",
                  week === w ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w === "this" ? "This week" : "Last week"}
              </Link>
            ))}
          </nav>
        }
      />
      <WeeklyReportTabs report={report} today={dhakaDateKey()} />
    </DashCard>
  );
}

export function WeeklyReportSkeleton() {
  return (
    <DashCard className="flex flex-col gap-5" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid grid-cols-3 gap-5 tablet:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-60 w-full" />
    </DashCard>
  );
}
