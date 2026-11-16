import { Skeleton } from "@/components/ui/skeleton";

/** Static shell while the session (and sidebar cookie) resolve. Same geometry as AdminShell. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-admin-sidebar shrink-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar p-6 laptop:flex">
        <Skeleton className="h-11 w-40" />
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="mt-2 h-8 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-4 border-b border-border bg-muted px-gutter laptop:h-admin-topbar">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="ml-auto hidden h-11 w-80 tablet:block" />
          <Skeleton className="size-10 rounded-full" />
        </div>
        <div className="grid gap-5 p-gutter">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
