import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import type { Section } from "@/lib/config/home";
import { getFeaturedProducts, getHotDeals, getPopularProducts } from "@/lib/queries/catalog";
import { ProductCard } from "../product-card";
import {
  fullRowClasses,
  ProductRail,
  ProductRailItem,
  ProductRailSkeleton,
  RAIL_CARD,
  SPOTLIGHT_CELL,
} from "../product-grid";
import { SectionHeading } from "../section-heading";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * The three product sections of Home. Each streams on its own behind a skeleton
 * that matches the card layout; the queries are "use cache" + cacheTag(products).
 *
 * Below laptop each section is a scroll-snap rail (44% / 30% cards). From laptop it
 * is the shared-border grid from the PNG (4 / 5 columns, partial rows trimmed).
 */

/** Rail card widths: 44vw / 30vw below laptop; grid columns above. */
const RAIL_SIZES = `${laptopSizes(264)}, (width >= 48rem) 30vw, 44vw`;

function ProductSection({
  id,
  section,
  children,
}: {
  id: string;
  section: Section;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="reveal flex flex-col gap-6 tablet:gap-8">
      <SectionHeading id={id} section={section} />
      {children}
    </section>
  );
}

const Empty = () => <p className="text-copy text-muted-foreground">No products yet.</p>;

// ── Popular Products (2 rows × 5) ──
export function PopularProducts({ section }: { section: Section }) {
  return (
    <ProductSection id="popular-products" section={section}>
      <Suspense fallback={<ProductRailSkeleton count={10} />}>
        <PopularProductsGrid />
      </Suspense>
    </ProductSection>
  );
}

async function PopularProductsGrid() {
  await connection();
  const products = await getPopularProducts(10);
  if (products.length === 0) return <Empty />;
  const fit = fullRowClasses(products.length, { fromLayer: 2 });
  return (
    <ProductRail className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      {products.map((p, i) => (
        <ProductRailItem key={p.id} className={fit[i]}>
          <ProductCard product={p} sizes={RAIL_SIZES} className={RAIL_CARD} />
        </ProductRailItem>
      ))}
    </ProductRail>
  );
}

// ── Hot Deals (gray band; spotlight card 2 × 2 + 11 cards) ──
export function HotDeals({
  section,
  spotlightBadge,
  countdownLabel,
}: {
  section: Section;
  spotlightBadge: string;
  countdownLabel: string;
}) {
  return (
    <div className="bg-muted py-10 laptop:py-15">
      <Container>
        <ProductSection id="hot-deals" section={section}>
          <Suspense fallback={<ProductRailSkeleton count={11} spotlight />}>
            <HotDealsGrid spotlightBadge={spotlightBadge} countdownLabel={countdownLabel} />
          </Suspense>
        </ProductSection>
      </Container>
    </div>
  );
}

async function HotDealsGrid({ spotlightBadge, countdownLabel }: { spotlightBadge: string; countdownLabel: string }) {
  await connection();
  const [spotlight, ...rest] = await getHotDeals(12);
  if (!spotlight) return <Empty />;
  const fit = fullRowClasses(rest.length, { leadCells: 4, fromLayer: 2 });
  // Below laptop the spotlight is a wider first rail item; cards keep their own height.
  return (
    <ProductRail className="items-start laptop:items-stretch motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      <ProductRailItem className={SPOTLIGHT_CELL}>
        <ProductCard
          product={spotlight}
          variant="spotlight"
          badges={[spotlightBadge]}
          countdownLabel={countdownLabel}
          sizes={`${laptopSizes(528)}, (width >= 48rem) 60vw, 88vw`}
          className={RAIL_CARD}
        />
      </ProductRailItem>
      {rest.map((p, i) => (
        <ProductRailItem key={p.id} className={fit[i]}>
          <ProductCard product={p} sizes={RAIL_SIZES} className={RAIL_CARD} />
        </ProductRailItem>
      ))}
    </ProductRail>
  );
}

// ── Featured Products (1 row × 5) ──
export function FeaturedProducts({ section }: { section: Section }) {
  return (
    <ProductSection id="featured-products" section={section}>
      <Suspense fallback={<ProductRailSkeleton count={5} />}>
        <FeaturedProductsGrid />
      </Suspense>
    </ProductSection>
  );
}

async function FeaturedProductsGrid() {
  await connection();
  const products = await getFeaturedProducts(5);
  if (products.length === 0) return <Empty />;
  const fit = fullRowClasses(products.length, { fromLayer: 2 });
  return (
    <ProductRail className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      {products.map((p, i) => (
        <ProductRailItem key={p.id} className={fit[i]}>
          <ProductCard product={p} sizes={RAIL_SIZES} className={RAIL_CARD} />
        </ProductRailItem>
      ))}
    </ProductRail>
  );
}
