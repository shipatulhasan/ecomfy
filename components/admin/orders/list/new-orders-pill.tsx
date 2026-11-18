"use client";

import { ArrowUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const POLL_MS = 30_000;

/**
 * "N new orders · Refresh": polls the count of orders placed since this list was
 * rendered (every 30 s while the tab is visible, and on focus). It never reloads
 * on its own, so the table doesn't reorder under the user.
 */
export function NewOrdersPill({ since }: { since: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [pending, startTransition] = useTransition();

  // A fresh render (refresh, navigation) moves `since`: start counting again.
  const [seen, setSeen] = useState(since);
  if (seen !== since) {
    setSeen(since);
    setCount(0);
  }

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/admin/orders/new-count?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!stopped && typeof data.count === "number") setCount(data.count);
      } catch {
        // Offline / transient: try again next tick.
      }
    };
    const id = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [since]);

  if (count === 0) return null;
  return (
    <div className="pointer-events-none sticky top-3 z-20 flex justify-center">
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        aria-live="polite"
        className="press pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-copy font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover disabled:opacity-70"
      >
        <ArrowUpIcon aria-hidden className="size-4" />
        {count} new order{count === 1 ? "" : "s"} · {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
