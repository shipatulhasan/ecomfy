import Image from "next/image";
import Link from "next/link";
import type { Asset } from "@/lib/assets";
import { productCopy } from "@/lib/config/product";
import { shopHref } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

/** "Brand: [logo]" (56×56 bordered tile). Links to the Shop filtered by the brand. */
export function BrandTile({ brand, logo, className }: { brand: string; logo: Asset | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-copy text-text-body">{productCopy.brand}</span>
      <Link
        href={shopHref({ brands: [brand] })}
        aria-label={`More from ${brand}`}
        className="press grid size-14 place-items-center overflow-hidden rounded-sm border border-border bg-background p-1 transition-colors hover:border-primary"
      >
        {logo ? (
          <Image src={logo.url} alt="" width={logo.width} height={logo.height} sizes="56px" className="size-full object-contain" />
        ) : (
          <span className="text-caption font-medium text-foreground">{brand}</span>
        )}
      </Link>
    </div>
  );
}
