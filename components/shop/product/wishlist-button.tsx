"use client";

import { HeartIcon } from "lucide-react";
import { startTransition } from "react";
import { toast } from "sonner";
import { toggleWishlist } from "@/lib/actions/wishlist";
import { cn } from "@/lib/utils";
import { useShopState } from "../shop-state";

/**
 * Heart toggle. Optimistic through the shared wishlist set, so the header count and
 * every other heart for the product change at once; rolls back with a toast on
 * error. Works signed out too: guests' hearts live in a cookie and merge into the
 * account on sign-in.
 *
 * - card: 40px outlined circle (product cards).
 * - soft: 52px green-tinted circle (Quick View / PDP purchase row).
 */
export function WishlistButton({
  productId,
  name,
  appearance = "card",
  className,
}: {
  productId: string;
  name: string;
  appearance?: "card" | "soft";
  className?: string;
}) {
  const { wishlist, setWishlisted } = useShopState();
  const optimisticSaved = wishlist.has(productId);

  function toggle() {
    const next = !optimisticSaved;
    setWishlisted(productId, next);
    startTransition(async () => {
      const result = await toggleWishlist({ productId });
      if (result.ok) {
        setWishlisted(productId, result.data.wishlisted);
        if (result.data.wishlisted) toast.success(`${name} saved to your wishlist`, { id: `wish-${productId}` });
      } else {
        setWishlisted(productId, !next);
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimisticSaved}
      aria-label={optimisticSaved ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      className={cn(
        "press relative z-10 grid shrink-0 place-items-center rounded-full tap-target",
        appearance === "card" &&
          "size-10 border border-muted bg-background text-foreground hover:bg-primary hover:text-primary-foreground",
        appearance === "soft" && "size-13 bg-secondary text-primary hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      <HeartIcon aria-hidden className={cn("size-5", optimisticSaved && "fill-sale text-sale")} />
    </button>
  );
}
