import Link from "next/link";
import { cn } from "@/lib/utils";

/** Dashboard.png card: white, 12 radius, 24 side padding, 16 top. */
export function DashCard({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("min-w-0 rounded-xl bg-card px-4 pt-4 pb-5 tablet:px-6 tablet:pb-6", className)} {...props}>
      {children}
    </section>
  );
}

export function DashCardHeader({
  title,
  titleId,
  action,
  className,
}: {
  title: React.ReactNode;
  titleId?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-3", className)}>
      <h2 id={titleId} className="flex items-center gap-1.5 text-h2 text-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Blue "See more ›" link under tables and lists. */
export function SeeMore({ href, label = "See more", className }: { href: string; label?: string; className?: string }) {
  return (
    <Link href={href} className={cn("tap-target inline-flex items-center gap-1 text-copy text-info hover:underline", className)}>
      {label} <span aria-hidden>›</span>
    </Link>
  );
}
