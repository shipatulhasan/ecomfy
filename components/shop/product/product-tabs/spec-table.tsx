import Link from "next/link";
import { Fragment } from "react";
import { pdpCopy } from "@/lib/config/product";
import type { ProductPageData } from "@/lib/queries/product";
import { shopHref } from "@/lib/shop-params";

const link = "tap-target inline-flex items-center transition-colors hover:text-foreground hover:underline";
const count = new Intl.NumberFormat("en-US");

/**
 * Additional Information spec table (PNG "Frame 188"): stored attributes
 * (ProductAttribute, in sortOrder) then the computed Category, Stock Status and Tags.
 *
 * - Laptop+: 112 label column, rows 12 apart, as in the PNG.
 * - Below laptop: stacked label-over-value rows with dividers (app list style).
 */
export function SpecTable({ product }: { product: ProductPageData }) {
  const { category, tags, totalStock } = product;
  const rows: { label: string; value: React.ReactNode }[] = [
    ...product.attributes.map((a) => ({ label: `${a.name}:`, value: a.value })),
    {
      label: pdpCopy.specs.category,
      value: (
        <Link href={shopHref({ category: category.slug })} className={link}>
          {category.name}
        </Link>
      ),
    },
    {
      label: pdpCopy.specs.stockStatus,
      value:
        totalStock > 0 ? (
          <>
            {pdpCopy.specs.available} <span className="text-muted-foreground">({count.format(totalStock)})</span>
          </>
        ) : (
          <span className="text-sale">{pdpCopy.specs.outOfStock}</span>
        ),
    },
  ];
  if (tags.length > 0) {
    rows.push({
      label: pdpCopy.specs.tags,
      value: (
        <span className="flex flex-wrap gap-x-1">
          {tags.map((t, i) => (
            <Fragment key={t}>
              <Link href={shopHref({ tags: [t] })} className={link}>
                {t}
                {i < tags.length - 1 && ","}
              </Link>
            </Fragment>
          ))}
        </span>
      ),
    });
  }

  return (
    <dl className="divide-y divide-border text-copy laptop:grid laptop:grid-cols-[7rem_minmax(0,1fr)] laptop:gap-y-3 laptop:divide-y-0">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-0.5 py-3 laptop:col-span-2 laptop:grid laptop:grid-cols-subgrid laptop:gap-0 laptop:py-0">
          <dt className="text-caption font-medium text-muted-foreground laptop:text-copy laptop:font-normal laptop:text-foreground">{r.label}</dt>
          <dd className="text-text-body">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
