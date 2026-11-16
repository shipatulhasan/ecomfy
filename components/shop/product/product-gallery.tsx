"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductImageData } from "@/lib/queries/product";
import { cn } from "@/lib/utils";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * Same `sizes` on both layouts: the browser picks one candidate URL for the first
 * image, so the eager image in the hidden layout reuses the visible one's download.
 */
const MAIN_SIZES = `${laptopSizes(556)}, 100vw`;

/**
 * Product images (Figma "Product Details Images" 648×556).
 *
 * - Laptop+: vertical thumbnail column (80×90, 4 visible) with up/down arrows that
 *   scroll it and disable at the ends; the active thumb has a primary border, a
 *   click swaps the 556 main image (all main images are stacked, so swaps are instant).
 * - Below laptop: a full-width scroll-snap strip with dot indicators, no thumbnails.
 *
 * CSS decides which layout shows; no width detection.
 */
export function ProductGallery({ images, name, className }: { images: ProductImageData[]; name: string; className?: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div aria-hidden className={cn("aspect-square w-full rounded-lg bg-muted laptop:w-162", className)} />;
  }
  return (
    <div className={className}>
      <DesktopGallery images={images} name={name} active={active} onSelect={setActive} />
      <MobileGallery images={images} name={name} />
    </div>
  );
}

function DesktopGallery({
  images,
  name,
  active,
  onSelect,
}: {
  images: ProductImageData[];
  name: string;
  active: number;
  onSelect: (i: number) => void;
}) {
  const column = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ top: true, bottom: true });

  const measure = useCallback(() => {
    const el = column.current;
    if (!el) return;
    setEnds({ top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 });
  }, []);

  useEffect(() => {
    const el = column.current;
    if (!el) return;
    measure();
    // Re-measure when the column becomes visible (it's display:none below laptop).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // One thumb + gap (Figma "Slide": 90 + 12), measured so it follows the rem root
  // scale. CSS scroll-behavior (motion-safe:scroll-smooth) decides smooth vs instant.
  const scroll = (dir: 1 | -1) => {
    const el = column.current;
    const thumb = el?.firstElementChild as HTMLElement | null;
    if (!el || !thumb) return;
    const step = thumb.offsetHeight + (Number.parseFloat(getComputedStyle(el).rowGap) || 0);
    el.scrollBy({ top: dir * step });
  };

  const arrow =
    "grid size-11 place-items-center rounded-full text-text-body transition-colors hover:text-primary disabled:text-muted-foreground/40 disabled:hover:text-muted-foreground/40";

  return (
    // The thumb column stretches to the main image's height (556 on desktop).
    <div className="hidden gap-3 laptop:flex">
      <div className="flex w-20 shrink-0 flex-col items-center">
        <button type="button" aria-label="Scroll thumbnails up" disabled={ends.top} onClick={() => scroll(-1)} className={cn(arrow, "mt-4")}>
          <ChevronUpIcon aria-hidden className="size-6 stroke-[1.5]" />
        </button>
        <ul
          ref={column}
          onScroll={measure}
          aria-label={`${name} images`}
          className="mt-5.5 flex min-h-0 w-20 flex-1 snap-y snap-mandatory flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <li key={img.url} className="snap-start">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "relative block h-22.5 w-20 border bg-background p-1 transition-colors",
                  i === active ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <Image src={img.url} alt="" fill sizes={laptopSizes(80)} className="object-contain" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" aria-label="Scroll thumbnails down" disabled={ends.bottom} onClick={() => scroll(1)} className={cn(arrow, "mt-8.5")}>
          <ChevronDownIcon aria-hidden className="size-6 stroke-[1.5]" />
        </button>
      </div>
      <div className="relative aspect-square max-w-139 min-w-0 flex-1">
        {images.map((img, i) => (
          <Image
            key={img.url}
            src={img.url}
            alt={img.alt || name}
            fill
            sizes={MAIN_SIZES}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
            placeholder={img.blurDataURL ? "blur" : "empty"}
            blurDataURL={img.blurDataURL ?? undefined}
            aria-hidden={i !== active}
            className={cn(
              "object-contain transition-opacity duration-300 motion-reduce:transition-none",
              i === active ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function MobileGallery({ images, name }: { images: ProductImageData[]; name: string }) {
  const strip = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const root = strip.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    for (const li of root.children) io.observe(li);
    return () => io.disconnect();
  }, [images.length]);

  const goTo = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth });

  return (
    <div className="flex flex-col gap-3 laptop:hidden">
      <ul
        ref={strip}
        aria-label={`${name} images`}
        className="rail motion-safe:scroll-smooth"
      >
        {images.map((img, i) => (
          <li
            key={img.url}
            data-index={i}
            aria-label={`Image ${i + 1} of ${images.length}`}
            className="relative aspect-square max-h-[42dvh] w-full shrink-0 snap-center"
          >
            <Image
              src={img.url}
              alt={img.alt || name}
              fill
              sizes={MAIN_SIZES}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              placeholder={img.blurDataURL ? "blur" : "empty"}
              blurDataURL={img.blurDataURL ?? undefined}
              className="object-contain"
            />
          </li>
        ))}
      </ul>
      {images.length > 1 && (
        <div className="flex justify-center gap-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === current ? "true" : undefined}
              className="grid h-6 w-6 place-items-center tap-target"
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
                  i === current ? "w-4 bg-primary" : "w-1.5 bg-border",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
