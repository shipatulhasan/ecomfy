/**
 * The Ecofy three-leaf logo mark, shared by <LogoMark> (components/shared/logo.tsx)
 * and the app-icon generator (scripts/app-icons.ts). Each leaf names the color token
 * it is painted with (designs/tokens.json → storefront.color).
 */
export const LOGO_MARK = {
  viewBox: "-1 -1 34 35",
  strokeWidth: 2,
  leaves: [
    { d: "M1 13 L5 2 L19 1 L15 12.5 Z", token: "brand-dark" },
    { d: "M0.5 19.5 L16.5 17 L19 27.5 L4 31.5 Z", token: "brand-light" },
    { d: "M21.5 3.5 L31.5 16.5 L22.5 29 L16 16.5 Z", token: "primary" },
  ],
} as const;
