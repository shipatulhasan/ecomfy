import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/config/home";

/** Section title + optional "View All →" (or custom actions, e.g. carousel arrows). */
export function SectionHeading({
  section,
  id,
  align = "between",
  actions,
  className,
}: {
  section: Section;
  id?: string;
  align?: "between" | "center";
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4",
        align === "center" ? "justify-center text-center" : "justify-between",
        className,
      )}
    >
      <h2 id={id} className="text-h2">
        {section.title}
      </h2>
      {actions}
      {section.viewAll && (
        <Link
          href={section.viewAll.href}
          className="group/cta tap-target inline-flex shrink-0 items-center gap-2 text-lead font-medium text-primary hover:text-brand-dark"
        >
          {section.viewAll.label}
          <span className="sr-only"> {section.title}</span>
          <ArrowRightIcon aria-hidden className="size-5 transition-transform duration-300 motion-safe:group-hover/cta:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
