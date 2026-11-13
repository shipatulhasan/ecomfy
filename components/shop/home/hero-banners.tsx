import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HeroMain, HeroSide } from "@/lib/config/home";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * Hero (Figma "Bannar" 1319×600): main banner 872 + two side banners 423×288.
 * Mobile: main, then the side banners stacked. Tablet: side banners side by side.
 * Laptop+: 872fr / 423fr columns. The main image is the LCP → preload.
 */
export function HeroBanners({ main, side }: { main: HeroMain; side: readonly [HeroSide, HeroSide] }) {
  return (
    <section aria-label="Promotions" className="grid gap-6 laptop:grid-cols-[872fr_423fr]">
      <MainBanner banner={main} />
      <div className="grid gap-6 tablet:grid-cols-2 laptop:grid-cols-1 laptop:grid-rows-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:delay-300 motion-safe:fill-mode-both">
        {side.map((b) => (
          <SideBanner key={b.title} banner={b} />
        ))}
      </div>
    </section>
  );
}

function MainBanner({ banner }: { banner: HeroMain }) {
  return (
    <div className="group/banner relative isolate flex min-h-105 overflow-hidden rounded-lg bg-brand-dark tablet:min-h-120 laptop:aspect-[872/600] laptop:min-h-0">
      <Image
        src={banner.image.url}
        alt=""
        fill
        preload
        fetchPriority="high"
        sizes={`${laptopSizes(872)}, 100vw`}
        className="-z-10 object-cover object-[80%_center] motion-safe:animate-settle laptop:object-center"
      />
      {/* Legibility where the photo slides under the copy (below laptop). */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-brand-ink/70 via-brand-ink/30 to-transparent laptop:hidden" />
      <div className="flex max-w-130 flex-col justify-center gap-6 p-6 tablet:p-10 laptop:gap-7.5 laptop:pl-15">
        <h1 className="text-display text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:delay-100">{banner.title}</h1>
        <div className="border-l-2 border-brand-light pl-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:delay-200">
          <p className="flex flex-wrap items-center gap-2 text-h4 font-medium text-primary-foreground">
            {banner.saleLead}
            <span className="rounded-sm bg-warning px-3 py-0.5 font-semibold">{banner.saleHighlight}</span>
          </p>
          <p className="mt-2 text-copy text-primary-foreground/80">{banner.subtitle}</p>
        </div>
        <Link
          href={banner.cta.href}
          className="group/cta inline-flex h-12.75 items-center gap-4 self-start rounded-full bg-background px-10 text-lead font-semibold text-primary transition-colors hover:bg-secondary motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:delay-300"
        >
          {banner.cta.label}
          <ArrowRightIcon aria-hidden className="size-5 transition-transform duration-300 motion-safe:group-hover/cta:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}

function SideBanner({ banner }: { banner: HeroSide }) {
  const dark = banner.tone === "dark";
  return (
    <div
      className={cn(
        "group/banner relative isolate flex min-h-60 overflow-hidden rounded-lg laptop:min-h-0",
        dark ? "items-center justify-center bg-brand-ink text-center" : "bg-muted",
      )}
    >
      <Image
        src={banner.image.url}
        alt=""
        fill
        sizes={`${laptopSizes(423)}, (width >= 48rem) 50vw, 100vw`}
        className={cn("-z-10 object-cover transition-[scale] duration-700 ease-out motion-safe:laptop:group-hover/banner:scale-105", dark ? "object-center" : "object-right")}
      />
      <div className={cn("flex flex-col p-8", dark ? "items-center gap-2" : "max-w-60 gap-4 laptop:max-w-none")}>
        <p
          className={cn(
            "text-copy font-medium tracking-wide uppercase",
            dark ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {banner.eyebrow}
        </p>
        <h2
          className={cn(
            "text-h2",
            dark ? "max-w-80 text-primary-foreground" : "-mt-2 text-foreground",
          )}
        >
          {banner.title}
        </h2>
        {banner.subtitle && <p className="-mt-2 text-copy text-text-body">{banner.subtitle}</p>}
        <Link
          href={banner.cta.href}
          className={cn(
            "group/cta tap-target inline-flex items-center gap-3 text-lead font-semibold text-primary hover:text-brand-dark",
            dark && "mt-6 hover:text-primary-foreground",
          )}
        >
          {banner.cta.label}
          <span className="sr-only">: {banner.title}</span>
          <ArrowRightIcon aria-hidden className="size-5 transition-transform duration-300 motion-safe:group-hover/cta:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
