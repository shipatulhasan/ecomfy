import Image from "next/image";
import { highlightIcons, type Highlight } from "@/lib/config/product";
import { cn } from "@/lib/utils";

/**
 * "64% Discount · 100% Organic" box under the video (PNG "Feature" 537×91):
 * 24/20 padding, features 30 apart, a 32 icon then the title/subtitle 8 after it.
 * The items come from productHighlights() (lib/config/product.ts).
 */
export function HighlightBox({ items, className }: { items: Highlight[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border p-4 tablet:flex-row tablet:flex-wrap tablet:gap-x-7.5 laptop:px-5 laptop:py-6",
        className,
      )}
    >
      {items.map((h) => {
        const icon = highlightIcons[h.icon];
        return (
          <li key={h.icon} className="flex items-center gap-2">
            <Image src={icon.url} alt="" width={icon.width} height={icon.height} className="size-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-copy font-medium text-foreground">{h.title}</p>
              <p className="text-caption text-muted-foreground">{h.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
