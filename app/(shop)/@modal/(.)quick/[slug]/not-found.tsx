import Link from "next/link";
import { RouteModal } from "@/components/shared/route-modal";
import { productCopy } from "@/lib/config/product";

/** Quick View for an unknown / unpublished product. */
export default function QuickViewNotFound() {
  return (
    <RouteModal title={productCopy.notFoundTitle} description={productCopy.notFoundBody} className="laptop:w-120">
      <div className="flex flex-col items-center gap-3 px-safe-gutter pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center laptop:p-10">
        <p className="text-h3 text-foreground">{productCopy.notFoundTitle}</p>
        <p className="text-copy text-muted-foreground">{productCopy.notFoundBody}</p>
        <Link
          href="/shop"
          className="press mt-2 inline-flex h-11 items-center rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground tap-target hover:bg-brand-dark"
        >
          {productCopy.backToShop}
        </Link>
      </div>
    </RouteModal>
  );
}
