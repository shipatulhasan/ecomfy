import Link from "next/link";
import { productCopy } from "@/lib/config/product";
import { shopHref } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

const link = "tap-target inline-flex items-center text-muted-foreground transition-colors hover:text-foreground hover:underline";

/** "Category: Vegetables" / "Tag: Vegetables Healthy …". Each links to the filtered Shop. */
export function ProductMeta({
  category,
  tags,
  className,
}: {
  category: { name: string; slug: string };
  tags: string[];
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col gap-x-1.5 gap-y-1 text-copy laptop:gap-y-3", className)}>
      <div className="flex flex-wrap items-center gap-x-1.5">
        <dt className="font-medium text-foreground">{productCopy.category}</dt>
        <dd>
          <Link href={shopHref({ category: category.slug })} className={link}>
            {category.name}
          </Link>
        </dd>
      </div>
      {tags.length > 0 && (
        <div className="flex items-baseline gap-x-1.5">
          <dt className="shrink-0 font-medium text-foreground">{productCopy.tag}</dt>
          <dd>
            <ul className="flex flex-wrap gap-x-1.5">
              {tags.map((t) => (
                <li key={t}>
                  <Link href={shopHref({ tags: [t] })} className={link}>
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
