import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Partner } from "@/lib/config/home";

/**
 * Partner logo strip as an endless marquee. Logos rest gray and turn brand green
 * on hover (two pre-tinted crops, cross-faded). The track holds the list twice and
 * slides -50%, so the loop is seamless; hovering the strip pauses it.
 * Reduced motion: no animation, no duplicate, logos wrap as a static row.
 */
export function PartnerLogos({ partners }: { partners: readonly Partner[] }) {
  return (
    <section
      aria-label="Our partners"
      className="group/marquee fade-edges-x overflow-hidden py-6 laptop:py-15 motion-reduce:[mask-image:none]"
    >
      <div className="flex w-max motion-safe:animate-marquee motion-safe:group-hover/marquee:paused motion-reduce:w-full">
        <LogoList partners={partners} />
        <LogoList partners={partners} duplicate />
      </div>
    </section>
  );
}

function LogoList({ partners, duplicate = false }: { partners: readonly Partner[]; duplicate?: boolean }) {
  return (
    <ul
      aria-hidden={duplicate || undefined}
      className={cn(
        "flex shrink-0 items-center",
        duplicate ? "motion-reduce:hidden" : "motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center",
      )}
    >
      {partners.map((p) => (
        <li
          key={p.name}
          className="group/logo flex h-8 w-40 shrink-0 items-center justify-center border-l border-border laptop:w-55"
        >
          <span className="relative">
            <Image
              src={p.image.url}
              alt={duplicate ? "" : p.name}
              width={p.image.width / 2}
              height={p.image.height / 2}
              className="h-6 w-auto opacity-50 transition-opacity duration-300 group-hover/logo:opacity-0 tablet:h-8"
            />
            <Image
              src={p.hoverImage.url}
              alt=""
              width={p.hoverImage.width / 2}
              height={p.hoverImage.height / 2}
              className="absolute inset-0 h-6 w-auto opacity-0 transition-opacity duration-300 group-hover/logo:opacity-100 tablet:h-8"
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
