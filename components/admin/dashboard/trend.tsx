import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** "↑ 10.4%" (success) / "↓ 14.4%" (sale), as in the KPI cards. null = no previous data. */
export function TrendBadge({ changePct, className }: { changePct: number | null; className?: string }) {
  if (changePct === null) {
    return <span className={cn("text-caption text-muted-foreground", className)}>new</span>;
  }
  const up = changePct >= 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  const value = `${Math.abs(changePct).toFixed(1)}%`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-caption font-medium", up ? "text-success" : "text-sale", className)}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{up ? "up" : "down"} </span>
      {value}
    </span>
  );
}
