import { MenuIcon, SunIcon } from "lucide-react";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { allowedNavHrefs } from "@/lib/admin/nav";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getAdminBadgeCounts } from "@/lib/queries/admin/counts";
import { AdminSidebar } from "./admin-sidebar";
import { CommandSearch } from "./command-search";
import { Notifications } from "./notifications";
import { PageTitle } from "./page-title";
import { UserMenu } from "./user-menu";

/**
 * Every admin page's chrome (app/admin/(panel)/layout.tsx): Nav.png sidebar and
 * the Dashboard.png topbar. Request-time (session, sidebar cookie), so the layout
 * renders it inside <Suspense>. requireStaff() here is the page-level gate; pages
 * check their own permission and every action re-checks.
 */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [jar, counts] = await Promise.all([cookies(), getAdminBadgeCounts()]);
  // shadcn Sidebar writes this cookie on toggle; reading it here avoids a flash.
  const defaultOpen = jar.get("sidebar_state")?.value !== "false";
  const allowed = allowedNavHrefs(user);

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "14.8125rem", // 237
          "--sidebar-width-icon": "6.25rem", // 100
        } as React.CSSProperties
      }
    >
      <AdminSidebar allowed={allowed} badges={{ pendingOrders: counts.pendingOrders }} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-5 border-b border-border bg-muted">
          <div className="flex h-16 items-center gap-3 px-gutter laptop:h-admin-topbar laptop:gap-8">
            <SidebarTrigger className="tap-target -ml-2 size-10 laptop:hidden" aria-label="Open menu">
              <MenuIcon aria-hidden />
            </SidebarTrigger>
            <div className="min-w-0 flex-1">
              <PageTitle />
            </div>
            <div className="hidden min-w-0 tablet:flex tablet:max-w-sm tablet:flex-1 laptop:max-w-none laptop:flex-none">
              <CommandSearch allowed={allowed} />
            </div>
            <div className="flex shrink-0 items-center gap-2 laptop:gap-5">
              <Notifications codToConfirm={counts.codToConfirm} awaitingPayment={counts.awaitingPayment} />
              <ThemeToggle />
              <UserMenu
                name={user.name}
                email={user.email}
                roleLabel={ROLE_LABELS[user.role as Role] ?? "Staff"}
                image={user.image ?? null}
              />
            </div>
          </div>
          {/* Mobile: search gets its own full-width row under the bar (DESIGN.md). */}
          <div className="px-gutter pb-3 tablet:hidden">
            <CommandSearch allowed={allowed} />
          </div>
        </header>
        <div id="admin-main" className="flex min-w-0 flex-1 flex-col">
          <Suspense>{children}</Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Light/dark pill (56×32, sun knob) from the PNG. No admin dark theme exists yet, so it's disabled. */
function ThemeToggle() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="switch"
          aria-checked="false"
          aria-disabled="true"
          aria-label="Dark mode (coming soon)"
          tabIndex={0}
          className="hidden h-8 w-14 cursor-not-allowed items-center rounded-full bg-secondary p-1 tablet:inline-flex"
        >
          <span className="grid size-6 place-items-center rounded-full bg-card shadow-xs">
            <SunIcon aria-hidden className="size-3.5 text-foreground" />
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Dark mode coming soon</TooltipContent>
    </Tooltip>
  );
}
