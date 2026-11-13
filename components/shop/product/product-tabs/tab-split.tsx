import { cn } from "@/lib/utils";

/**
 * Descriptions / Additional Information layout: main column 648 | 136 gap | aside
 * 536 on laptop+ (exactly the 1320 container), 32 under the tab nav. Below laptop
 * the aside (video, highlights) stacks under the main content.
 */
export function TabSplit({ main, aside, className }: { main: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 pt-6 laptop:grid laptop:grid-cols-[minmax(0,648fr)_minmax(0,536fr)] laptop:items-start laptop:gap-x-34 laptop:pt-8",
        className,
      )}
    >
      <div className="min-w-0">{main}</div>
      {aside && <div className="flex min-w-0 flex-col gap-6">{aside}</div>}
    </div>
  );
}
