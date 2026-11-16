import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Ecofy Admin" },
  // The admin is never indexed (login and register included).
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * Admin root: `.theme-admin` swaps colors + font to the admin token set.
 * Access control lives one level down: (auth) pages are public, (panel) pages
 * run requireStaff() in AdminShell. proxy.ts is only the first gate.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <div className="theme-admin flex min-h-svh flex-1 flex-col">{children}</div>;
}
