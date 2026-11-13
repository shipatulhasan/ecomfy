import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Ecomfy Admin" } };

// Admin panel. `.theme-admin` swaps colors + font to the admin token set.
// proxy.ts redirects non-admins first; requireAdmin() here is the authoritative
// check, and every admin server action must call requireAdmin() as well.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-admin flex min-h-svh flex-1">
      <Suspense fallback={<Skeleton className="m-6 h-96 flex-1" />}>
        <AdminOnly>{children}</AdminOnly>
      </Suspense>
    </div>
  );
}

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
