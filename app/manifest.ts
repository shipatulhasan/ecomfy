import type { MetadataRoute } from "next";
import { appColors, appIcons, appName } from "@/lib/config/pwa";

/**
 * Web app manifest. "Add to Home Screen" opens the storefront full screen
 * (standalone). Icons come from `pnpm icons`. There's no service worker or
 * offline mode yet.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description: "Fresh fruit, vegetables and organic groceries delivered.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: appColors.theme,
    background_color: appColors.background,
    categories: ["shopping", "food"],
    icons: [
      { src: appIcons.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: appIcons.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: appIcons.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
