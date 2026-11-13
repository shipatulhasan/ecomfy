"use client";

import Link from "next/link";
import { PDP_TAB_EVENT, PDP_TABS_ID } from "./product-tabs/tab-events";

/**
 * "4 Review" link. It goes to the PDP's Customer Feedback tab
 * (`/product/{slug}?tab=reviews#product-tabs`). When it's already on that PDP, it
 * switches the tab in place and scrolls to the tabs instead of navigating (no
 * refetch). From the Quick View it's a normal navigation.
 */
export function ReviewsLink({ slug, className, children }: { slug: string; className?: string; children: React.ReactNode }) {
  const href = `/product/${slug}?tab=reviews#${PDP_TABS_ID}`;
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        const tabs = document.getElementById(PDP_TABS_ID);
        if (window.location.pathname !== `/product/${slug}` || !tabs) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(PDP_TAB_EVENT, { detail: "reviews" }));
        // The section sets --pdp-scroll to smooth only under motion-safe (CSS decides).
        const behavior = getComputedStyle(tabs).getPropertyValue("--pdp-scroll").trim() === "smooth" ? "smooth" : "auto";
        tabs.scrollIntoView({ behavior, block: "start" });
      }}
    >
      {children}
    </Link>
  );
}
