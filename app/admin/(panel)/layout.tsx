import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { ShellSkeleton } from "@/components/admin/shell/shell-skeleton";

/** Sidebar + topbar for every admin page (Nav.png, Dashboard.png chrome). */
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
