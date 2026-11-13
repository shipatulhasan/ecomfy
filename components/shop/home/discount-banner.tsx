import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { HomeContent } from "@/lib/config/home";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * "SUMMER SALE 37% OFF" banner (1320×358). Laptop+: copy on the dark right side.
 * Below laptop the photo slides to its dark half so the copy stays legible.
 */
export function DiscountBanner({ banner }: { banner: HomeContent["discount"] }) {
  return (
    <section
      aria-labelledby="discount-title"
      className="group/banner reveal relative isolate overflow-hidden rounded-lg bg-footer laptop:aspect-[1320/358]"
    >
      <Image
        src={banner.image.url}
        alt=""
        fill
        sizes={`${laptopSizes(1320)}, 100vw`}
        className="-z-10 object-cover object-[85%_center] laptop:object-center transition-[scale] duration-700 ease-out motion-safe:laptop:group-hover/banner:scale-105"
      />
      {/* Below laptop the copy overlaps the vegetables: darken behind it. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-footer/90 via-footer/70 to-footer/20 laptop:hidden" />
      <div className="flex h-full flex-col justify-center gap-4 p-8 tablet:p-12 laptop:ml-[62.5%] laptop:p-0 laptop:pr-10">
        <p className="text-copy font-medium tracking-wide text-primary-foreground uppercase">{banner.eyebrow}</p>
        <h2 id="discount-title" className="text-display text-primary-foreground">
          <span className="text-warning">{banner.highlight}</span> <span className="font-normal">{banner.title}</span>
        </h2>
        <p className="max-w-100 text-lead text-primary-foreground/70">{banner.description}</p>
        <Link
          href={banner.cta.href}
          className="group/cta mt-2 inline-flex h-12.75 items-center gap-4 self-start rounded-full bg-primary px-10 text-lead font-semibold text-primary-foreground transition-colors hover:bg-brand-dark"
        >
          {banner.cta.label}
          <ArrowRightIcon aria-hidden className="size-5 transition-transform duration-300 motion-safe:group-hover/cta:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
