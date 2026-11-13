"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useTransition } from "react";
import { SHOP_PATH, ShopParam } from "@/lib/shop-params";

/**
 * The query string of the latest filter change that hasn't landed in the URL yet.
 * Shared by every filter control (sidebar, sheet, sort) so a second click during a
 * pending navigation builds on the first one instead of on the stale URL.
 */
let pendingQs: string | null = null;

/**
 * URL-driven filter state for the Shop page. Controls read `params` (optimistic:
 * reflects a click immediately) and call `update()`, which rewrites the query string
 * with router.replace inside a transition. Any filter change resets `page`.
 */
export function useShopParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.toString();
  const [optimisticQs, setOptimisticQs] = useOptimistic(current);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (pendingQs === current) pendingQs = null;
  }, [current]);

  const params = useMemo(() => new URLSearchParams(optimisticQs), [optimisticQs]);

  function update(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(pendingQs ?? current);
    mutate(next);
    next.delete(ShopParam.page);
    const qs = next.toString();
    pendingQs = qs;
    startTransition(() => {
      setOptimisticQs(qs);
      router.replace(qs ? `${SHOP_PATH}?${qs}` : SHOP_PATH, { scroll: false });
    });
  }

  return { params, update, isPending };
}

/** Toggle one value of a repeatable param (tag, brand). */
export function toggleValue(p: URLSearchParams, key: string, value: string) {
  const values = p.getAll(key);
  p.delete(key);
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  for (const v of next) p.append(key, v);
}
