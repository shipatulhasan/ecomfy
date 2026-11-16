"use client";

import { ChevronsLeftRightIcon, HouseIcon, LogOutIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogo } from "@/components/admin/admin-logo";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { adminSignOutAction } from "@/lib/actions/admin-auth";
import { ADMIN_NAV, type AdminBadgeKey, type AdminNavItem, navItemFor } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

/**
 * Nav.png: 237 open / 100 collapsed (Variant2), logo row 93 high with the "<>"
 * collapse chip on its bottom-right corner, three groups split by full-width
 * rules, items 40 high (icon 22 at x=30, label at x=60, 8 apart), the active
 * item a filled primary pill (42 high), Log out tile at the bottom.
 *
 * Below laptop the vendored Sidebar renders the same content in a Sheet, opened
 * from the topbar menu button. Collapse state lives in the `sidebar_state` cookie
 * (read by AdminShell for the first paint, so there's no flash).
 */
export function AdminSidebar({
  allowed,
  badges,
}: {
  allowed: string[];
  badges: Partial<Record<AdminBadgeKey, number>>;
}) {
  const pathname = usePathname();
  const active = navItemFor(pathname);
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.href)) })).filter(
    (g) => g.items.length > 0,
  );
  const close = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="relative h-23.25 shrink-0 justify-center gap-0 border-b border-sidebar-border p-0 px-6 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link href="/admin" onClick={close} aria-label="Dashboard" className="tap-target flex items-center">
          <AdminLogo className="group-data-[collapsible=icon]:hidden" />
          <AdminLogo markOnly className="hidden group-data-[collapsible=icon]:inline-flex" />
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          className="absolute -right-3.25 -bottom-3.25 z-20 hidden size-6.5 place-items-center rounded-md border border-sidebar-border bg-card text-foreground shadow-xs transition-colors hover:text-primary laptop:grid"
        >
          <ChevronsLeftRightIcon aria-hidden className="size-4" />
        </button>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto pt-4">
        {groups.map((group, gi) => (
          <nav
            key={group.label}
            aria-label={group.label}
            className={cn(
              "flex flex-col gap-1.5 px-3.5 pb-3",
              gi > 0 && "border-t border-sidebar-border pt-3",
              // Settings & Preferences sits at the bottom (Nav.png), with free space above it.
              gi === groups.length - 1 && gi > 0 && "mt-auto",
            )}
          >
            <p className="flex h-6 items-center px-2 text-caption text-sidebar-foreground/80 group-data-[collapsible=icon]:invisible">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={active?.href === item.href}
                badge={item.badge ? badges[item.badge] : undefined}
                onNavigate={close}
              />
            ))}
          </nav>
        ))}
      </SidebarContent>

      <SidebarFooter className="shrink-0 justify-center border-t border-sidebar-border px-6 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 desktop:py-6">
        <form action={adminSignOutAction}>
          <button
            type="submit"
            className="press flex h-13 w-47.25 items-center gap-1 rounded-lg bg-secondary p-2 text-left transition-colors hover:bg-accent group-data-[collapsible=icon]:w-auto"
          >
            <span className="grid size-9 place-items-center rounded-md bg-card text-sale">
              <LogOutIcon aria-hidden className="size-5" />
            </span>
            <span className="px-3 text-lead font-bold text-sale group-data-[collapsible=icon]:sr-only">Log out</span>
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  badge?: number;
  onNavigate: () => void;
}) {
  // Dashboard's active icon is the filled house (mingcute:home-4-fill).
  const Icon = item.href === "/admin" && active ? FilledHouse : item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={item.label}
      {...(item.external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "tap-target relative flex h-10 items-center gap-2 rounded-lg px-4 text-lead transition-colors",
        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-13.25 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        active
          ? "h-10.5 bg-primary font-bold text-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon aria-hidden className={cn(active && item.href === "/admin" ? "size-6" : "size-5.5")} strokeWidth={1.5} />
        {badge ? (
          <span
            aria-hidden
            className={cn(
              "absolute -top-2 -right-2.5 grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[0.625rem] leading-none font-bold tabular-nums ring-2",
              active ? "bg-primary-foreground text-primary ring-primary" : "bg-sale text-destructive-foreground ring-sidebar",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="truncate group-data-[collapsible=icon]:sr-only">{item.label}</span>
      {badge ? <span className="sr-only">, {badge} pending</span> : null}
      {item.external && (
        <SquareArrowOutUpRightIcon
          aria-hidden
          strokeWidth={1.5}
          className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden"
        />
      )}
    </Link>
  );
}

function FilledHouse(props: React.ComponentProps<typeof HouseIcon>) {
  return <HouseIcon {...props} className={cn(props.className, "fill-current stroke-primary")} />;
}
