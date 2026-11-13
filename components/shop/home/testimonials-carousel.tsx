"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/** Embla carousel whose prev/next buttons live in the section heading (as in the design). */
export function TestimonialsCarousel({ title, slides }: { title: string; slides: React.ReactNode[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback((a: NonNullable<CarouselApi>) => {
    setCanPrev(a.canScrollPrev());
    setCanNext(a.canScrollNext());
  }, []);

  useEffect(() => {
    if (!api) return;
    api.on("select", sync).on("reInit", sync);
    // Initial sync once Embla has measured.
    requestAnimationFrame(() => sync(api));
    return () => {
      api.off("select", sync).off("reInit", sync);
    };
  }, [api, sync]);

  const arrow = (dir: "prev" | "next", enabled: boolean) => (
    <button
      type="button"
      onClick={() => (dir === "prev" ? api?.scrollPrev() : api?.scrollNext())}
      disabled={!enabled}
      aria-label={dir === "prev" ? "Previous testimonials" : "Next testimonials"}
      className={cn(
        "grid size-11.25 place-items-center rounded-full border transition-colors tap-target disabled:opacity-40",
        dir === "next"
          ? "border-primary bg-primary text-primary-foreground hover:bg-brand-dark"
          : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
      )}
    >
      {dir === "prev" ? <ArrowLeftIcon aria-hidden className="size-5" /> : <ArrowRightIcon aria-hidden className="size-5" />}
    </button>
  );

  return (
    <section aria-labelledby="testimonials" aria-roledescription="carousel">
      <Carousel setApi={setApi} opts={{ align: "start" }} className="flex flex-col gap-6 tablet:gap-8">
        <div className="flex items-center justify-between gap-4">
          <h2 id="testimonials" className="text-h2">
            {title}
          </h2>
          <div className="flex gap-3">
            {arrow("prev", canPrev)}
            {arrow("next", canNext)}
          </div>
        </div>
        <CarouselContent className="-ml-6">
          {slides.map((slide, i) => (
            <CarouselItem key={i} className="pl-6 tablet:basis-1/2 laptop:basis-1/3" aria-roledescription="slide">
              {slide}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
