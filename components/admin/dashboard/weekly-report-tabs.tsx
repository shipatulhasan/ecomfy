"use client";

import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatDhaka, dhakaMidnight } from "@/lib/admin/date-range";
import { formatCountCompact, formatPriceCompact } from "@/lib/money";
import type { WeeklyReport } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";

type Metric = "customers" | "revenue";

const config = {
  customers: { label: "New customers", color: "var(--chart-1)" },
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Stat tabs + area chart (client: the tab switch and the tooltip). */
export function WeeklyReportTabs({ report, today }: { report: WeeklyReport; today: string }) {
  const [metric, setMetric] = useState<Metric>("customers");
  const tabs: { key: string; value: string; label: string; metric?: Metric; href?: string }[] = [
    { key: "customers", value: formatCountCompact(report.newCustomers), label: "Customers", metric: "customers" },
    { key: "total", value: formatCountCompact(report.totalProducts), label: "Total Products", href: "/admin/products" },
    { key: "stock", value: formatCountCompact(report.stockProducts), label: "Stock Products", href: "/admin/products?stock=in" },
    { key: "out", value: formatCountCompact(report.outOfStock), label: "Out of Stock", href: "/admin/products?stock=out" },
    { key: "revenue", value: formatPriceCompact(report.revenue), label: "Revenue", metric: "revenue" },
  ];
  const fmt = (v: number) => (metric === "revenue" ? formatPriceCompact(v) : formatCountCompact(v));
  const data = report.series.map((d) => ({
    ...d,
    day: formatDhaka(dhakaMidnight(d.date), "EEE"),
    weekday: formatDhaka(dhakaMidnight(d.date), "EEEE"),
    // Days after today have no data yet: leave a gap instead of a fake zero.
    value: d.date > today ? null : d[metric],
  }));
  const todayLabel = data.find((d) => d.date === today)?.day;
  // Early in the week (e.g. Sunday) there is one point and no line to draw: show dots.
  const sparse = data.filter((d) => d.value !== null).length < 2;

  return (
    <>
      <div role="tablist" aria-label="Report" className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 tablet:grid-cols-5 tablet:gap-x-5">
        {tabs.map((t) => {
          const selected = t.metric === metric;
          const inner = (
            <>
              <span className="block text-h1 font-bold text-foreground tabular-nums">{t.value}</span>
              <span className="mt-1 block text-caption text-muted-foreground">{t.label}</span>
            </>
          );
          const cls = cn(
            "tap-target block border-b-2 pt-1 pb-3 text-left transition-colors tablet:px-2.5",
            selected ? "border-primary" : "border-border hover:border-muted-foreground",
          );
          return t.metric ? (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMetric(t.metric!)}
              className={cls}
            >
              {inner}
            </button>
          ) : (
            <Link key={t.key} href={t.href!} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>

      <ChartContainer config={config} className="mt-8 aspect-auto h-60 w-full" role="tabpanel" aria-label={config[metric].label}>
        <AreaChart data={data} margin={{ top: 48, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="report-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} horizontal={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            tick={(props) => {
              const { x, y, payload } = props as { x: number | string; y: number | string; payload: { value: string } };
              return (
                <text
                  x={Number(x)}
                  y={Number(y) + 4}
                  textAnchor="middle"
                  className={cn("text-caption", payload.value === todayLabel ? "fill-foreground font-bold" : "fill-muted-foreground")}
                >
                  {payload.value}
                </text>
              );
            }}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={(v: number) => fmt(v)}
            tick={{ className: "fill-muted-foreground text-caption" }}
            allowDecimals={false}
          />
          {todayLabel && <ReferenceLine x={todayLabel} stroke="var(--chart-1)" strokeDasharray="3 3" />}
          <ChartTooltip
            cursor={{ stroke: "var(--chart-1)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !p || p.value === null) return null;
              return (
                <div className="rounded-md border border-primary bg-accent px-3 py-1.5 text-center text-caption text-foreground shadow-xs">
                  <p>{p.weekday}</p>
                  <p className="font-bold">{fmt(p.value)}</p>
                </div>
              );
            }}
          />
          <Area
            dataKey="value"
            type="linear"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#report-fill)"
            activeDot={{ r: 4, fill: "var(--card)", stroke: "var(--chart-1)", strokeWidth: 2 }}
            connectNulls={false}
            dot={sparse ? { r: 4, fill: "var(--card)", stroke: "var(--chart-1)", strokeWidth: 2 } : false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </>
  );
}
