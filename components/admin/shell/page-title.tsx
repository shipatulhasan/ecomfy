"use client";

import { usePathname } from "next/navigation";
import { navSectionFor } from "@/lib/admin/nav";

/** Topbar title (Dashboard.png: "Dashboard", 20px bold): the menu item the path belongs to. */
export function PageTitle() {
  const pathname = usePathname();
  const item = navSectionFor(pathname);
  return <h1 className="truncate text-h1 text-foreground">{item?.label ?? "Admin"}</h1>;
}
