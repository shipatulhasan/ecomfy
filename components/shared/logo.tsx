import Image from "next/image";
import Link from "next/link";
import { LOGO_MARK } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";

/**
 * Ecofy logo: three-leaf mark + wordmark. Colors are tokens (brand-dark /
 * brand-light / primary); `tone="light"` is the white wordmark on the dark footer.
 * Admin Settings → Store can rename the store (`name`) or upload an image logo
 * (`logoUrl`, shown instead of the mark + wordmark).
 */
export function Logo({
  tone = "default",
  name = siteConfig.name,
  logoUrl,
  className,
}: {
  tone?: "default" | "light";
  name?: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <Link href="/" aria-label={`${name} home`} className={cn("tap-target inline-flex shrink-0 items-center gap-2", className)}>
      {logoUrl ? (
        <span className="relative block h-8 w-36 laptop:h-10 laptop:w-45">
          <Image src={logoUrl} alt="" fill sizes="(width >= 64rem) 11.25rem, 9rem" className="object-contain object-left" />
        </span>
      ) : (
        <>
          <LogoMark className="h-7 w-auto laptop:h-8" />
          <span className={cn("text-h2 font-medium tracking-tight", tone === "light" ? "text-footer-foreground" : "text-brand-ink")}>{name}</span>
        </>
      )}
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={LOGO_MARK.viewBox}
      aria-hidden
      className={className}
      strokeLinejoin="round"
      strokeWidth={LOGO_MARK.strokeWidth}
    >
      {LOGO_MARK.leaves.map((leaf) => (
        <path key={leaf.token} d={leaf.d} className={leafClass[leaf.token]} />
      ))}
    </svg>
  );
}

// Literal class names so Tailwind generates them.
const leafClass: Record<(typeof LOGO_MARK.leaves)[number]["token"], string> = {
  "brand-dark": "fill-brand-dark stroke-brand-dark",
  "brand-light": "fill-brand-light stroke-brand-light",
  primary: "fill-logo-leaf stroke-logo-leaf",
};
