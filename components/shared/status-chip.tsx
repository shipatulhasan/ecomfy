import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

/**
 * Status pill (orders: Processing / On the way / Completed / Cancelled / Cash on
 * delivery …; later admin Paid/Unpaid, Active/Inactive). Built on shadcn `badge`;
 * every tone is a soft token background with a contrasting token text color.
 */
const tones: Record<StatusTone, string> = {
  neutral: "bg-muted-strong text-text-body",
  warning: "bg-warning-soft text-warning-strong",
  info: "bg-info-soft text-info-strong",
  success: "bg-success-soft text-brand-dark",
  danger: "bg-sale-soft text-sale",
};

export function StatusChip({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <Badge
      variant="secondary"
      data-tone={tone}
      className={cn("h-auto rounded-full px-2.5 py-0.5 text-caption font-medium", tones[tone], className)}
    >
      {children}
    </Badge>
  );
}
