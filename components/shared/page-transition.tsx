import { ViewTransition } from "react";

/**
 * Wraps a page's content (in each page.tsx, not the layout, since layouts persist
 * and never enter/exit) so route changes animate with the View Transitions API:
 *
 * - a link with `transitionTypes={["nav-forward"]}` (drill down: product card,
 *   category tile) slides the content left;
 * - `transitionTypes={["nav-back"]}` (back chevron) slides it right;
 * - anything else (tab bar, browser back) cross-fades.
 *
 * The header and tab bar are anchored. The CSS lives in app/globals.css. It's
 * disabled from laptop up and for prefers-reduced-motion. Browsers without support
 * simply swap.
 */
const animation = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" };

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={animation} exit={animation} default="none">
      {children}
    </ViewTransition>
  );
}
