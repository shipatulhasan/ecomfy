import { cn } from "@/lib/utils";

/**
 * Horizontal rail for categories, product carousels, banners, logos and filter
 * chips. Pure CSS (scroll-snap) and a Server Component, so there's no carousel JS.
 *
 * - The rail bleeds to the screen edge out of <Container>. The first item lines up
 *   with the container padding (`rail-bleed`, which clears safe areas).
 * - Items have a fixed width per layer so the next one peeks (`size`).
 * - `laptop="grid"` turns the rail into a grid from laptop up. Pass the grid columns
 *   and gap in `className` (e.g. "laptop:grid-cols-6 laptop:gap-6"), so laptop and
 *   desktop keep the PNG layout. `laptop="rail"` keeps scrolling at every width.
 *
 *   <Rail size="product" laptop="grid" className="laptop:grid-cols-4">
 *     {items.map((p) => <RailItem key={p.id}><ProductCard … /></RailItem>)}
 *   </Rail>
 */
const sizes = {
  /** Product cards: 44% mobile, 30% tablet (two cards + a peek / three + a peek). */
  product: "[--rail-item:44%] tablet:[--rail-item:30%]",
  /** Category tiles: 28% / 20%. */
  category: "[--rail-item:28%] tablet:[--rail-item:20%]",
  /** Banners, blog cards, feature tiles: 85% / 48%. */
  wide: "[--rail-item:85%] tablet:[--rail-item:48%]",
  /** Partner logos: 30% / 22%. */
  logo: "[--rail-item:30%] tablet:[--rail-item:22%]",
  /** Stat tiles (account profile quick stats): a peek on phones, exactly three across on tablet. */
  stat: "[--rail-item:40%] tablet:[--rail-item:calc((100%-2rem)/3)]",
  /** Chips size to their content. */
  chip: "[--rail-item:auto]",
  /** Order card item thumbnails (3rem squares). */
  thumb: "[--rail-item:3rem]",
} as const;

export type RailSize = keyof typeof sizes;

export function Rail({
  size = "product",
  laptop = "rail",
  bleed = true,
  className,
  ...props
}: {
  size?: RailSize;
  laptop?: "rail" | "grid";
  /** False inside cards: no edge-to-edge bleed, the rail stays in its box. */
  bleed?: boolean;
} & React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="rail"
      className={cn(
        "rail gap-3 tablet:gap-4",
        bleed && "rail-bleed",
        sizes[size],
        laptop === "grid" &&
          "laptop:mx-0 laptop:grid laptop:snap-none laptop:scroll-p-0 laptop:overflow-visible laptop:px-0 laptop:[--rail-item:auto]",
        className,
      )}
      {...props}
    />
  );
}

export function RailItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="rail-item" className={cn("w-(--rail-item) shrink-0 snap-start", className)} {...props} />;
}
