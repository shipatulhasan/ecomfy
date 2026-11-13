import Image from "next/image";
import Link from "next/link";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * Popular Categories tile (Figma "Category" 200×213): image + name, green border on
 * hover (laptop+). Below laptop: press feedback, and it slides into the Shop.
 */
export function CategoryTile({
  category,
}: {
  category: { name: string; slug: string; imageUrl: string | null };
}) {
  return (
    <Link
      href={`/shop?category=${category.slug}`}
      transitionTypes={["nav-forward"]}
      className="group/tile press flex h-full flex-col items-center gap-2 rounded-md border border-border bg-card px-2 pt-3 pb-4 text-center hover:border-brand-dark hover:shadow-card-hover tablet:gap-3 laptop:pb-5.25"
    >
      <div className="relative aspect-[176/134] w-full transition-[scale] duration-500 ease-out motion-safe:laptop:group-hover/tile:scale-110">
        {category.imageUrl && (
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes={`${laptopSizes(176)}, (width >= 48rem) 20vw, 28vw`}
            className="object-contain"
          />
        )}
      </div>
      <span className="text-copy font-medium text-foreground transition-colors group-hover/tile:text-brand-dark tablet:text-lead laptop:text-[1.125rem]">
        {category.name}
      </span>
    </Link>
  );
}
