"use client";

import { useEffect } from "react";

export const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

/**
 * Unsaved-changes guard while `dirty`: tab close / reload (beforeunload), and
 * in-app links (a capture-phase click listener runs before next/link navigates).
 *
 * `scope`:
 * - "page" (default): links to another pathname (Add / Edit Product);
 * - "url": any change of pathname or query too (settings tabs are `?tab=` links).
 */
export function useUnsavedChangesGuard(dirty: boolean, { scope = "page" }: { scope?: "page" | "url" } = {}) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const url = new URL(a.getAttribute("href")!, location.href);
      if (url.origin !== location.origin) return;
      const same = scope === "url" ? url.pathname + url.search === location.pathname + location.search : url.pathname === location.pathname;
      if (same) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, scope]);
}
