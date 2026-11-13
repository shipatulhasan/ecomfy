/** Initials on the soft green disc when there's no photo. Fills its (round) parent. */
export function UserAvatarFallback({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span aria-hidden className="@container absolute inset-0 grid place-items-center bg-secondary font-semibold text-secondary-foreground">
      <span className="text-[length:36cqw] leading-none">{initials || "?"}</span>
    </span>
  );
}
