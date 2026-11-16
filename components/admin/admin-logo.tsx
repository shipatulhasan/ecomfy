import { LogoMark } from "@/components/shared/logo";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

/**
 * Ecofy logo at the admin sizes: sidebar (mark 33 + 36px wordmark, Nav.png),
 * collapsed sidebar (mark only) and the Login/Register hero (`size="hero"`, white).
 */
export function AdminLogo({
  size = "sidebar",
  markOnly,
  className,
}: {
  size?: "sidebar" | "hero" | "hero-sm";
  markOnly?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", size === "sidebar" ? "gap-2.5" : "gap-3", className)}>
      <LogoMark
        className={cn(
          "w-auto",
          size === "sidebar" && "h-8.5",
          size === "hero" && "h-12.5",
          size === "hero-sm" && "h-6.5",
        )}
      />
      {!markOnly && (
        <span
          className={cn(
            "font-logo leading-none font-medium tracking-tight",
            size === "sidebar" && "text-4xl text-brand-ink",
            size === "hero" && "text-6xl text-primary-foreground",
            size === "hero-sm" && "text-4xl text-primary-foreground",
          )}
        >
          {siteConfig.name}
        </span>
      )}
    </span>
  );
}
