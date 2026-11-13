import * as React from "react"

/**
 * Below the laptop breakpoint (64rem = 1024px, app/globals.css).
 *
 * Only used by the vendored shadcn Sidebar (components/ui/sidebar.tsx) to swap the
 * fixed admin sidebar for a Sheet on tablet/mobile. It is the one sanctioned JS
 * width check — app code must stay CSS-only (`pnpm lint:design` enforces this).
 */
const QUERY = "(width < 64rem)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

// useSyncExternalStore instead of setState-in-effect (react-hooks lint rule).
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
