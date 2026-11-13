/**
 * `sizes` for next/image under the laptop+ fluid root scale (app/globals.css).
 *
 * A box of `designPx` on the 1920 storefront artboard renders at:
 * - 0.75 × designPx from 1024 to 1440 (root fixed at 12px);
 * - designPx / 1920 of the viewport from 1440 to 1920 (root = 100vw / 120);
 * - designPx from 1920 up (root capped at 16px).
 *
 * Media queries in `sizes` resolve rem against the initial 16px, like breakpoints.
 * Append the tablet/mobile conditions after it:
 *   `${laptopSizes(264)}, (width >= 48rem) 33vw, 50vw`
 */
export function laptopSizes(designPx: number): string {
  const vw = Number(((designPx / 1920) * 100).toFixed(2));
  return `(width >= 120rem) ${designPx}px, (width >= 90rem) ${vw}vw, (width >= 64rem) ${Math.round(designPx * 0.75)}px`;
}
