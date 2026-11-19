import { cn } from "@/lib/utils";

/**
 * Admin detail building blocks (Order detail, Transaction detail sheet).
 * Add Products.png card: white, 12 radius, 24 padding (16 on mobile).
 */
export function DetailCard({
  title,
  titleId,
  action,
  className,
  children,
}: {
  title: React.ReactNode;
  titleId: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className={cn("min-w-0 rounded-xl bg-card p-4 tablet:p-6", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={titleId} className="text-h2 text-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One label / value pair inside `<dl className="flex flex-col divide-y divide-border">`. */
export function DetailRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 text-copy", className)}>
      <dt className="shrink-0 text-text-body">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}
