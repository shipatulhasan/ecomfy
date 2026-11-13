import type { Metadata, Viewport } from "next";
import { Lato, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { CURRENCY_INIT_SCRIPT } from "@/components/shared/currency-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appColors, appIcons, appName } from "@/lib/config/pwa";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// Storefront font (designs/tokens.json → storefront.typography).
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Admin font; applied by `.theme-admin` (app/theme.css).
const lato = Lato({
  variable: "--font-admin",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "Ecomfy — Fresh & Healthy Organic Food", template: "%s · Ecomfy" },
  description: "Fresh fruit, vegetables and organic groceries delivered.",
  // Installed from the iOS home screen: open full screen. "default" status bar (dark
  // text on white) because black-translucent would put white text over the white header.
  appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
  icons: { apple: appIcons.apple },
};

// viewport-fit=cover lets the app draw under notches / the home indicator; fixed and
// sticky chrome pads itself with env(safe-area-inset-*) (app/globals.css → App shell).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: appColors.theme,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-currency="BDT"
      // The inline script below may switch data-currency to the saved choice before paint.
      suppressHydrationWarning
      className={`${poppins.variable} ${lato.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: CURRENCY_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        {/* Light only until a dark design exists. */}
        <Toaster theme="light" />
      </body>
    </html>
  );
}
