import Link from "next/link";
import { Rail, RailItem } from "@/components/shared/rail";
import { settingsHref, SETTINGS_TABS, type SettingsTabKey } from "@/lib/admin/settings-tabs";
import { can, type PermissionSubject } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

/**
 * Section navigation (derived; the PNG relies on the sidebar's "General Info"):
 * the admin list-toolbar tab pill (mint track, active tab white). Below laptop
 * it's a horizontal Rail of chips. Personal tabs | store tabs (Super Admin).
 */
export function SettingsTabs({ active, user }: { active: SettingsTabKey; user: PermissionSubject }) {
  const tabs = SETTINGS_TABS.filter((t) => !t.permission || can(user, t.permission));
  return (
    <nav aria-label="Settings sections">
      <Rail size="chip" laptop="grid" className="laptop:flex laptop:w-fit laptop:max-w-full laptop:flex-wrap laptop:gap-1 laptop:rounded-lg laptop:bg-secondary laptop:p-1">
        {tabs.map((t, i) => {
          const on = t.key === active;
          const divider = i > 0 && t.permission && !tabs[i - 1]!.permission;
          return (
            <RailItem key={t.key} className={cn(divider && "laptop:ml-3")}>
              <Link
                href={settingsHref(t.key)}
                replace
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "press tap-target inline-flex h-10 items-center rounded-full px-4 text-lead whitespace-nowrap transition-colors laptop:h-8 laptop:rounded-md",
                  on ? "bg-primary text-primary-foreground laptop:bg-card laptop:font-medium laptop:text-foreground laptop:shadow-sm" : "bg-card text-text-body hover:text-foreground laptop:bg-transparent",
                )}
              >
                {t.label}
              </Link>
            </RailItem>
          );
        })}
      </Rail>
    </nav>
  );
}
