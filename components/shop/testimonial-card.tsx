import Image from "next/image";
import type { Testimonial } from "@/lib/config/home";
import { StarRating } from "./star-rating";

/** Client Testimonials card (Figma "Testimonial Card" 424×254). */
export function TestimonialCard({ testimonial: t }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full min-h-63.5 flex-col gap-4 rounded-lg bg-card p-6">
      <svg aria-hidden viewBox="0 0 32 26" className="h-6.5 w-8 fill-brand-light">
        <path d="M0 26V14.6C0 6.9 3.4 2 10.3 0l1.6 3.3C8 5 6.3 8 6.1 12.3H12V26H0Zm20 0V14.6C20 6.9 23.4 2 30.3 0l1.6 3.3C28 5 26.3 8 26.1 12.3H32V26H20Z" transform="scale(-1,-1) translate(-32,-26)" />
      </svg>
      <blockquote className="flex-1 text-copy text-text-body">{t.quote}</blockquote>
      <figcaption className="flex items-center gap-3">
        <Image src={t.avatar.url} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
        <div className="flex-1">
          <p className="text-lead font-medium text-foreground">{t.name}</p>
          <p className="text-copy text-muted-foreground">{t.role}</p>
        </div>
        <StarRating rating={t.rating} starClassName="size-5" />
      </figcaption>
    </figure>
  );
}
