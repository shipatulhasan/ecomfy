import Image from "next/image";
import { SocialIcon } from "@/components/shared/social-icons";
import type { Asset } from "@/lib/assets";
import type { Section } from "@/lib/config/home";
import { SectionHeading } from "../section-heading";
import { laptopSizes } from "@/lib/image-sizes";

/** Follow us on Instagram: 6 tiles, 3 / 3 / 6 columns; green overlay + glyph on hover. */
export function InstagramFeed({
  section,
  href,
  images,
}: {
  section: Section;
  href: string;
  images: readonly Asset[];
}) {
  return (
    <section aria-labelledby="instagram" className="reveal flex flex-col gap-6 tablet:gap-8">
      <SectionHeading id="instagram" section={section} align="center" />
      <ul className="grid grid-cols-3 gap-3 tablet:gap-6 laptop:grid-cols-6">
        {images.map((img, i) => (
          <li key={img.url}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Instagram post ${i + 1}`}
              className="group/ig relative block aspect-square overflow-hidden rounded-lg"
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes={`${laptopSizes(200)}, 33vw`}
                className="object-cover transition-transform duration-300 group-hover/ig:scale-105"
              />
              <span className="absolute inset-0 grid place-items-center bg-brand-dark/60 text-primary-foreground opacity-0 transition-opacity group-hover/ig:opacity-100 group-focus-visible/ig:opacity-100">
                <SocialIcon
                  network="instagram"
                  className="size-8 transition-[scale] duration-300 motion-safe:scale-75 motion-safe:group-hover/ig:scale-100"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
