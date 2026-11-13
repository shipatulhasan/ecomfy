import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { DiscountBanner } from "@/components/shop/home/discount-banner";
import { FeatureStrip } from "@/components/shop/home/feature-strip";
import { HeroBanners } from "@/components/shop/home/hero-banners";
import { InstagramFeed } from "@/components/shop/home/instagram-feed";
import { LatestNews } from "@/components/shop/home/latest-news";
import { PartnerLogos } from "@/components/shop/home/partner-logos";
import { FeaturedProducts, HotDeals, PopularProducts } from "@/components/shop/home/product-sections";
import { PopularCategories } from "@/components/shop/home/popular-categories";
import { PromoBanners } from "@/components/shop/home/promo-banners";
import { Testimonials } from "@/components/shop/home/testimonials";
import { homeContent as home } from "@/lib/config/home";

/**
 * Storefront Home (designs/screens/web/Home.png). Sections are 45px apart on
 * desktop (`gap-section`); the gray bands (Hot Deals, Testimonials) are full-bleed.
 * Static marketing copy comes from lib/config/home.ts; catalog sections stream
 * from cached queries behind skeletons.
 *
 * Below laptop the card/tile sections are scroll-snap rails (components/shared/rail.tsx).
 */
export default function HomePage() {
  return (
    <PageTransition>
    <div className="flex flex-col gap-section py-section">
      <Container className="flex flex-col gap-section">
        <HeroBanners main={home.hero.main} side={home.hero.side} />
        <FeatureStrip features={home.features} />
        <PopularCategories section={home.sections.popularCategories} />
        <PopularProducts section={home.sections.popularProducts} />
        <PromoBanners promos={home.promos} />
      </Container>

      <HotDeals
        section={home.sections.hotDeals}
        spotlightBadge={home.hotDeals.spotlightBadge}
        countdownLabel={home.hotDeals.countdownLabel}
      />

      <Container className="flex flex-col gap-section">
        <DiscountBanner banner={home.discount} />
        <FeaturedProducts section={home.sections.featuredProducts} />
        <LatestNews section={home.sections.latestNews} posts={home.news} />
      </Container>

      <Testimonials section={home.sections.testimonials} testimonials={home.testimonials} />

      <Container className="flex flex-col gap-section">
        <PartnerLogos partners={home.partners} />
        <InstagramFeed section={home.sections.instagram} href={home.instagram.href} images={home.instagram.images} />
      </Container>
    </div>
    </PageTransition>
  );
}
