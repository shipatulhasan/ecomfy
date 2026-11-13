import Link from "next/link";
import { LOGO_MARK } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";

/**
 * Ecofy logo: three-leaf mark + wordmark. Colors are tokens (brand-dark /
 * brand-light / primary); `tone="light"` is the white wordmark on the dark footer.
 */
export function Logo({
  tone = "default",
  className,
}: {
  tone?: "default" | "light";
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} home`}
      className={cn("tap-target inline-flex shrink-0 items-center gap-2", className)}
    >
      <LogoMark className="h-7 w-auto laptop:h-8" />
      <span
        className={cn(
          "text-h2 font-medium tracking-tight",
          tone === "light" ? "text-footer-foreground" : "text-brand-ink",
        )}
      >
        {siteConfig.name}
      </span>
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
  primary: "fill-primary stroke-primary",
};
