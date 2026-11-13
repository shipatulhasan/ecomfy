"use client";

import { HeartIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { SIGN_IN_REQUIRED } from "@/lib/actions/result";
import { toggleWishlist } from "@/lib/actions/wishlist";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";
import { useShopState } from "../shop-state";

/**
 * Heart toggle, optimistic. Signed-out visitors get a toast prompt with a "Sign in"
 * action (the action re-checks the session too).
 *
 * - card: 40px outlined circle (product cards).
 * - soft: 52px green-tinted circle (Quick View / PDP purchase row).
 */
export function WishlistButton({
  productId,
  name,
  appearance = "card",
  signInNext,
  className,
}: {
  productId: string;
  name: string;
  appearance?: "card" | "soft";
  /** Where to come back after signing in (defaults to the current path). */
  signInNext?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, user, wishlist, setWishlisted } = useShopState();
  const saved = wishlist.has(productId);
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);

  const promptSignIn = () =>
    toast(productCopy.wishlistSignIn, {
      id: "wishlist-sign-in",
      action: {
        label: productCopy.signIn,
        onClick: () => router.push(`/sign-in?next=${encodeURIComponent(signInNext ?? pathname)}`),
      },
    });

  function toggle() {
    if (ready && !user) return promptSignIn();
    startTransition(async () => {
      setOptimisticSaved(!saved);
      const result = await toggleWishlist({ productId });
      if (result.ok) {
        startTransition(() => setWishlisted(productId, result.data.wishlisted));
      } else if (result.error === SIGN_IN_REQUIRED) {
        promptSignIn();
      } else {
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
