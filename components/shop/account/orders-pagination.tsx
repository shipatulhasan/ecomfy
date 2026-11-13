import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Order_History.png pagination: 36 design-px circles, prev/next outlined, the
 * current page filled primary. Plain links (?page=N), so it works without JS.
 * Phones show prev / "Page x of y" / next.
 */
const href = (page: number) => (page <= 1 ? "/account/orders" : `/account/orders?page=${page}`);

export function OrdersPagination({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  const numbers = pageWindow(page, pages);
  return (
    <nav aria-label="Order history pages" className="flex items-center justify-center gap-3">
      <Arrow page={page - 1} disabled={page <= 1} label="Previous page">
        <ChevronLeftIcon aria-hidden className="size-5" />
      </Arrow>
      <ol className="hidden items-center tablet:flex">
        {numbers.map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} aria-hidden className="grid size-9 place-items-center text-copy text-text-subtle">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  "tap-target grid size-9 place-items-center rounded-full text-copy",
                  n === page ? "bg-primary font-medium text-primary-foreground" : "text-text-body hover:text-primary",
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="text-copy text-text-body tablet:hidden">
        Page {page} of {pages}
      </p>
      <Arrow page={page + 1} disabled={page >= pages} label="Next page">
        <ChevronRightIcon aria-hidden className="size-5" />
      </Arrow>
    </nav>
  );
}

function Arrow({ page, disabled, label, children }: { page: number; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "tap-target grid size-9 place-items-center rounded-full border";
  if (disabled)
    return (
      <span aria-hidden className={cn(cls, "border-transparent bg-muted-strong text-muted-foreground")}>
        {children}
      </span>
    );
  return (
    <Link href={href(page)} aria-label={label} className={cn(cls, "border-border text-foreground hover:border-primary hover:text-primary")}>
      {children}
    </Link>
  );
}

/** 1 … 4 5 6 … 12 */
function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push(null);
    out.push(n);
  });
  return out;
}
