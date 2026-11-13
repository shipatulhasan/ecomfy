"use client";

import { Share2Icon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { FacebookGlyph, SocialIcon } from "@/components/shared/social-icons";
import type { SocialNetwork } from "@/lib/config/site";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";

const enc = encodeURIComponent;

// Feature detection (not width detection): is the Web Share API available?
const noopSubscribe = () => () => {};
const hasNativeShare = () => typeof navigator.share === "function";

/**
 * "Share item:" row with real share URLs for the product page (Facebook filled, as
 * in the design). Instagram has no web share URL, so it copies the link instead.
 * Below laptop, where the Web Share API exists, a single native "Share" button
 * replaces the row (the OS share sheet is the app-like pattern).
 */
export function ShareButtons({
  url,
  title,
  image,
  className,
}: {
  /** Absolute product URL (/product/[slug]). */
  url: string;
  title: string;
  /** Absolute image URL (Pinterest). */
  image?: string;
  className?: string;
}) {
  const canShare = useSyncExternalStore(noopSubscribe, hasNativeShare, () => false);

  const links: { network: SocialNetwork; label: string; href: string }[] = [
    { network: "facebook", label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { network: "twitter", label: "Share on X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
    {
      network: "pinterest",
      label: "Pin on Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(title)}${image ? `&media=${enc(image)}` : ""}`,
    },
  ];

  const circle =
    "press grid size-10 place-items-center rounded-full tap-target transition-colors hover:bg-primary hover:text-primary-foreground";

  async function copyForInstagram() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(productCopy.linkCopied);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Dismissed by the user: nothing to do.
    }
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="press flex h-10 items-center gap-2 rounded-full border border-border px-4 text-copy font-medium text-foreground tap-target laptop:hidden"
        >
          <Share2Icon aria-hidden className="size-4" />
          {productCopy.shareNative}
        </button>
      )}
      <div className={cn("items-center gap-2.5", canShare ? "hidden laptop:flex" : "flex")}>
        <span className="text-copy text-text-body">{productCopy.share}</span>
        <ul className="flex items-center gap-1.25">
          {links.map((l, i) => (
            <li key={l.network}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={l.label}
                className={cn(circle, i === 0 ? "bg-primary text-primary-foreground hover:bg-brand-dark" : "text-foreground")}
              >
                {l.network === "facebook" ? (
                  <FacebookGlyph className="size-5" />
                ) : (
                  <SocialIcon network={l.network} className="size-4.5" />
                )}
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={copyForInstagram} aria-label="Copy link to share on Instagram" className={cn(circle, "text-foreground")}>
              <SocialIcon network="instagram" className="size-4.5" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
