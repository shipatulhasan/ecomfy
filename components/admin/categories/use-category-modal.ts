"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * The Create / Edit Category modal lives in the URL (?modal=new, ?edit=<id>), so
 * it survives a refresh and the back button closes it. Opening pushes a history
 * entry with the native History API, which Next.js syncs into useSearchParams
 * without a server round trip; closing goes back when we pushed it, otherwise
 * (a fresh load on ?edit=…) it replaces the URL without the param.
 */
export type CategoryModalState = { kind: "new" } | { kind: "edit"; id: string } | null;

let pushedByUs = false; // shared by the header button and the list
if (typeof window !== "undefined") {
  // Browser back / forward: the entry we pushed is gone (or not ours).
  window.addEventListener("popstate", () => {
    pushedByUs = false;
  });
}

function urlWith(patch: (sp: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  url.searchParams.delete("modal");
  url.searchParams.delete("edit");
  patch(url.searchParams);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useCategoryModal() {
  const sp = useSearchParams();
  const edit = sp.get("edit");
  const state: CategoryModalState = sp.get("modal") === "new" ? { kind: "new" } : edit && /^[A-Za-z0-9_-]{1,40}$/.test(edit) ? { kind: "edit", id: edit } : null;

  const open = useCallback((next: Exclude<CategoryModalState, null>) => {
    const href = urlWith((s) => (next.kind === "new" ? s.set("modal", "new") : s.set("edit", next.id)));
    window.history.pushState(null, "", href);
    pushedByUs = true;
  }, []);

  const close = useCallback(() => {
    if (pushedByUs) {
      pushedByUs = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", urlWith(() => {}));
    }
  }, []);

  return { state, open, close };
}
