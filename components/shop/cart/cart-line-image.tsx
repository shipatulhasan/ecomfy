import Image from "next/image";
import { cn } from "@/lib/utils";
import type { CartLine } from "@/lib/cart/pricing";

/** Product photo in a fixed box (mini cart 120×100, cart table 100×100, cards). */
export function CartLineImage({
  image,
  sizes,
  className,
}: {
  image: CartLine["image"];
  sizes: string;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {image ? (
        <Image src={image.url} alt={image.alt} fill sizes={sizes} className="object-contain" />
      ) : (
        <div aria-hidden className="size-full rounded-md bg-muted" />
      )}
    </div>
  );
}
