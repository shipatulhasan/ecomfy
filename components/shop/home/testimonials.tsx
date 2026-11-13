import { Container } from "@/components/shared/container";
import type { Section, Testimonial } from "@/lib/config/home";
import { TestimonialCard } from "../testimonial-card";
import { TestimonialsCarousel } from "./testimonials-carousel";

/** Client Testimonials band: carousel with 1 / 2 / 3 cards per view, arrows in the heading. */
export function Testimonials({ section, testimonials }: { section: Section; testimonials: readonly Testimonial[] }) {
  return (
    <div className="bg-muted-strong py-10 laptop:py-15">
      {/* Reveal the content, not the band, so the gray background never fades. */}
      <Container className="reveal">
        <TestimonialsCarousel
          title={section.title}
          slides={testimonials.map((t) => (
            <TestimonialCard key={t.name} testimonial={t} />
          ))}
        />
      </Container>
    </div>
  );
}
