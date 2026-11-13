import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Rail, RailItem } from "@/components/shared/rail";
import { cn } from "@/lib/utils";
import type { Promo } from "@/lib/config/home";
import { CountdownTimer } from "../countdown-timer";
import { laptopSizes } from "@/lib/image-sizes";

/** Three promo banners (424×536): a rail below laptop (85% / 48%), 3 columns from laptop. */
export function PromoBanners({ promos }: { promos: readonly Promo[] }) {
  return (
    <section aria-label="Offers" className="reveal">
      <Rail size="wide" laptop="grid" className="laptop:grid-cols-3 laptop:gap-6">
        {promos.map((p) => (
          <RailItem key={p.title}>
            <PromoBanner promo={p} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}

const toneClass: Record<Promo["tone"], string> = {
  blue: "bg-info text-primary-foreground",
  dark: "bg-footer text-primary-foreground",
  yellow: "bg-warning text-foreground",
};

function PromoBanner({ promo, className }: { promo: Promo; className?: string }) {
  const inverse = promo.tone !== "yellow";
  return (
    <div
      className={cn(
        "group/banner relative isolate flex aspect-[424/536] flex-col items-center overflow-hidden rounded-lg px-6 pt-8 text-center",
        toneClass[promo.tone],
        className,
      )}
    >
      <Image
        src={promo.image.url}
        alt=""
        fill
        sizes={`${laptopSizes(424)}, (width >= 48rem) 48vw, 85vw`}
        className="-z-10 object-cover object-bottom transition-[scale] duration-700 ease-out motion-safe:laptop:group-hover/banner:scale-105"
      />
      <p className="text-copy font-medium tracking-wide uppercase">{promo.eyebrow}</p>
      <h2 className="mt-4 text-h1 laptop:mt-5">{promo.title}</h2>
      {promo.countdown && <CountdownTimer mode={promo.countdown} tone="inverse" className="mt-4" />}
      {promo.price && (
        <p className="mt-4 text-lead">
          {promo.price.lead} <span className="text-h4 font-semibold text-warning">{promo.price.value}</span>
        </p>
      )}
      {promo.highlight && (
        <p className="mt-3 flex items-center gap-3 text-lead">
          {promo.highlight.lead}
          <span className="rounded-md bg-foreground px-3 py-1.5 text-h4 font-semibold text-warning">
            {promo.highlight.value}
          </span>
        </p>
      )}
      <Link
        href={promo.cta.href}
        className={cn(
          "group/cta mt-6 inline-flex h-11.25 items-center gap-3 rounded-full bg-background px-8 text-copy font-semibold text-primary transition-colors hover:bg-secondary",
          inverse && "shadow-dropdown",
        )}
      >
        {promo.cta.label}
        <span className="sr-only">: {promo.title}</span>
        <ArrowRightIcon aria-hidden className="size-5 transition-transform duration-300 motion-safe:group-hover/cta:translate-x-1" />
      </Link>
    </div>
  );
}
