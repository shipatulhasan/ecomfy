import { productCopy, stockStatus } from "@/lib/config/product";
import { cn } from "@/lib/utils";

/** "In Stock" / "Only N left" / "Out of Stock" chip next to the product title. Presentational. */
export function StockBadge({ stock, className }: { stock: number; className?: string }) {
  const status = stockStatus(stock);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-1 text-copy whitespace-nowrap",
        status === "in" && "bg-success-soft text-brand-dark",
        status === "low" && "bg-warning/15 text-foreground",
        status === "out" && "bg-sale-soft text-sale",
        className,
      )}
    >
      {status === "in" ? productCopy.inStock : status === "low" ? productCopy.lowStock(stock) : productCopy.outOfStock}
    </span>
  );
}
