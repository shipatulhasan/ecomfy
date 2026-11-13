import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { pageHref, pageWindow, type ShopFilters } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

/**
 * Shop.png pagination: 36px circles, prev (muted when disabled), current page in
 * primary, "…" gaps, next (bordered). Real links (crawlable, work without JS); they
 * scroll back to the top. Window: current ±1 from tablet (1 2 3 4 5 … 21), ±0 on mobile.
 */
export function ShopPagination({ filters, totalPages }: { filters: ShopFilters; totalPages: number }) {
  if (totalPages <= 1) return null;
  const page = filters.page;
  return (
    <nav aria-label="Pagination" className="flex justify-center">
      <ul className="flex items-center gap-1 tablet:gap-3">
        <li>
          <Step filters={filters} to={page - 1} disabled={page <= 1} label="Previous page">
            <ChevronLeftIcon aria-hidden className="size-5" />
          </Step>
        </li>
        <PageList filters={filters} items={pageWindow(page, totalPages, 0)} className="contents tablet:hidden" />
        <PageList filters={filters} items={pageWindow(page, totalPages, 1)} className="hidden tablet:contents" />
        <li>
          <Step filters={filters} to={page + 1} disabled={page >= totalPages} label="Next page">
            <ChevronRightIcon aria-hidden className="size-5" />
          </Step>
        </li>
      </ul>
    </nav>
  );
}

const circle = "tap-target grid size-9 place-items-center rounded-full text-copy";

function PageList({ filters, items, className }: { filters: ShopFilters; items: (number | "ellipsis")[]; className: string }) {
  return (
    <li className={className}>
      <ul className="contents">
        {items.map((n, i) =>
          n === "ellipsis" ? (
            <li key={`gap-${i}`} aria-hidden className={cn(circle, "text-text-body")}>
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={pageHref(filters, n)}
                aria-current={n === filters.page ? "page" : undefined}
                aria-label={`Page ${n}`}
                className={cn(
                  circle,
                  "press transition-colors",
                  n === filters.page
                    ? "bg-primary text-primary-foreground"
                    : "text-text-body hover:bg-secondary hover:text-brand-dark",
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ul>
    </li>
  );
}

function Step({
  filters,
  to,
  disabled,
  label,
  children,
}: {
  filters: ShopFilters;
  to: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(circle, "bg-muted-strong text-muted-foreground")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={pageHref(filters, to)}
      aria-label={label}
      rel={to < filters.page ? "prev" : "next"}
      className={cn(circle, "press border border-border text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground")}
    >
      {children}
    </Link>
  );
}
