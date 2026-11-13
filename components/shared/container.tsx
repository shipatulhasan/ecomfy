import { cn } from "@/lib/utils";

type ContainerProps<T extends React.ElementType> = {
  as?: T;
  /**
   * shop  — storefront: side gutter per layer (24 / 24 / 16 / 16 design-px, or the safe-area inset if larger) and
   *         content capped at 82.5rem (1320 design-px, Figma), centered with auto margins. With the
   *         laptop+ fluid root scale that is 990px from 1024 to 1440 and 1320px from 1920.
   * admin — admin panel: own gutters (24 / 24 / 32 / 32), fluid width beside the sidebar.
   */
  variant?: "shop" | "admin";
} & Omit<React.ComponentPropsWithoutRef<T>, "as">;

/** The only page-width wrapper — never hand-roll max-width / side padding on a screen. */
export function Container<T extends React.ElementType = "div">({
  as,
  variant = "shop",
  className,
  ...props
}: ContainerProps<T>) {
  const Comp: React.ElementType = as ?? "div";
  return (
    <Comp
      data-slot="container"
      className={cn(
        "w-full px-safe-gutter", // = px-gutter, plus landscape notch clearance
        variant === "shop" && "mx-auto max-w-page",
        className,
      )}
      {...props}
    />
  );
}
