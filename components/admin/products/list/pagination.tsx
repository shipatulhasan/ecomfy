import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { productParamsHref, type ProductListParams } from "@/lib/admin/products/params";
import { pageWindow } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

/**
 * Product List.png pagination: "← Previous" (white, shadow) | numbered 36px
 * squares with "....." | "Next →" (green). Mobile keeps prev / current / next.
 */
export function ProductPagination({ params, pages }: { params: ProductListParams; pages: number }) {
  if (pages <= 1) return null;
  const page = Math.min(params.page, pages);
  const href = (n: number) => productParamsHref(params, { page: n });
  const edge = "tap-target inline-flex h-10.5 items-center gap-2 rounded-lg px-4 text-lead font-medium transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <PageLink
        href={page > 1 ? href(page - 1) : null}
        className={cn(edge, "border border-border bg-card text-foreground shadow-sm hover:bg-muted")}
        rel="prev"
      >
        <ArrowLeftIcon aria-hidden className="size-5" />
        <span className="hidden tablet:inline">Previous</span>
        <span className="sr-only tablet:hidden">Previous page</span>
      </PageLink>

      <ol className="flex items-center gap-2 tablet:gap-4">
        {pageWindow(page, pages, 1).map((n, i) =>
          n === "ellipsis" ? (
            <li key={`e${i}`} aria-hidden className="hidden h-9 w-9 place-items-center rounded-md border border-border text-copy text-foreground tablet:grid">
              .....
            </li>
          ) : (
            <li key={n} className={cn(n !== page && "hidden tablet:block")}>
              <Link
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={cn(
                  "tap-target grid size-9 place-items-center rounded-md border text-lead transition-colors",
                  n === page ? "border-accent bg-accent font-bold text-foreground" : "border-border text-foreground hover:bg-muted",
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ol>

      <PageLink href={page < pages ? href(page + 1) : null} className={cn(edge, "bg-primary text-primary-foreground hover:bg-primary-hover")} rel="next">
        <span className="hidden tablet:inline">Next</span>
        <span className="sr-only tablet:hidden">Next page</span>
        <ArrowRightIcon aria-hidden className="size-5" />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, className, rel, children }: { href: string | null; className: string; rel: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={className}>
      {children}
    </Link>
  );
}
