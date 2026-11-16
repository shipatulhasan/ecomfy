import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/admin/shell/coming-soon";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { navSectionFor } from "@/lib/admin/nav";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";

/**
 * Menu destinations that aren't built yet (and their sub-pages): a Coming soon
 * panel inside the shell, never a 404. Paths outside every menu section still 404.
 * A real page added at the same path takes precedence over this catch-all.
 */
export const metadata: Metadata = { title: "Coming soon" };

export default async function AdminComingSoonPage({ params }: PageProps<"/admin/[...slug]">) {
  const { slug } = await params;
  const item = navSectionFor(`/admin/${slug.join("/")}`);
  if (!item) notFound();
  const user = await requireStaff();
  if (item.permission && !can(user, item.permission)) return <Forbidden />;
  return <ComingSoon title={item.label} />;
}
