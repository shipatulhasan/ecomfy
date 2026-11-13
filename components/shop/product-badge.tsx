import { cn } from "@/lib/utils";

/** "Sale 50%" (sale token) / "Best Sale" (info token) / "Out of Stock" (dark) chips on product cards. */
export function ProductBadge({
  tone,
  children,
  className,
}: {
  tone: "sale" | "info" | "dark";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.75 text-copy whitespace-nowrap",
        tone === "sale" && "bg-sale text-primary-foreground",
        tone === "info" && "bg-info text-info-foreground",
        tone === "dark" && "bg-foreground text-background",
        className,
      )}
    >
      {children}
    </span>
  );
}
