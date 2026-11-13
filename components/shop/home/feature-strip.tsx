import Image from "next/image";
import { Rail, RailItem } from "@/components/shared/rail";
import type { Feature } from "@/lib/config/home";

/**
 * "Free Shipping · Support 24/7 · Secure Payment · Money-Back" strip.
 * - Laptop+: one shadowed card with 4 columns, as in the PNG.
 * - Below laptop: a rail of small feature cards (85% / 48%).
 */
export function FeatureStrip({ features }: { features: readonly Feature[] }) {
  return (
    <section aria-label="Why shop with us" className="reveal laptop:rounded-lg laptop:bg-card laptop:p-10 laptop:shadow-dropdown">
      <Rail size="wide" laptop="grid" className="laptop:grid-cols-4 laptop:gap-1">
        {features.map((f) => (
          <RailItem
            key={f.title}
            className="group/feature flex items-center gap-4 rounded-lg border border-border bg-card p-4 laptop:rounded-none laptop:border-0 laptop:bg-transparent laptop:p-0"
          >
            <Image
              src={f.icon.url}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 transition-transform duration-300 motion-safe:laptop:group-hover/feature:-translate-y-1"
            />
            <div>
              <h3 className="text-lead font-semibold text-foreground">{f.title}</h3>
              <p className="mt-0.5 text-copy text-muted-foreground">{f.description}</p>
            </div>
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
