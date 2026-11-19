/**
 * "Need assistance?" art (Add Members.png: a bar chart with a rising line and a
 * figure). Drawn in currentColor at varying opacity instead of a crop: in the PNG
 * the card sits under the drawer's dim overlay, so a crop would carry the tint.
 */
export function AssistanceIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 222 156" aria-hidden className={className}>
      <path d="M28 70c10-40 60-58 96-44 30-14 76 4 74 46 14 26-6 70-50 70H52C14 142 6 104 28 70Z" fill="currentColor" opacity=".14" />
      {[
        [62, 96, 46],
        [86, 76, 66],
        [110, 88, 54],
        [134, 52, 90],
        [158, 66, 76],
      ].map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="14" height={h} rx="3" fill="currentColor" opacity=".35" />
      ))}
      <polyline points="56,82 82,58 108,66 134,30 160,48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [56, 82],
        [82, 58],
        [108, 66],
        [134, 30],
        [160, 48],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="5" fill="currentColor" />
      ))}
      <circle cx="184" cy="74" r="7" fill="currentColor" opacity=".9" />
      <path d="M176 86h16l-2 32h-12Z" fill="currentColor" opacity=".7" />
      <path d="M179 118l-3 24M188 118l3 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      <path d="M190 90l8-22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity=".7" />
      <line x1="30" y1="142" x2="200" y2="142" stroke="currentColor" strokeWidth="2" opacity=".4" />
    </svg>
  );
}
