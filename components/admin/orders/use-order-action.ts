"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Runs an order server action: error toast (a stale order offers "Reload"),
 * success toast, then `after`. The actions refresh the page themselves.
 * Resolves to the result so dialogs can show field errors in place.
 */
export function useOrderAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = <T,>(action: () => Promise<ActionResult<T>>, success: ((data: T) => string) | null, after?: (data: T) => void) =>
    new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        const res = await action();
        if (!res.ok) {
          const stale = res.error.startsWith("This order changed");
          if (!res.fieldErrors) {
            toast.error(res.error, stale ? { action: { label: "Reload", onClick: () => router.refresh() } } : undefined);
          }
          resolve(res);
          return;
        }
        if (success) toast.success(success(res.data));
        after?.(res.data);
        resolve(res);
      });
    });

  return { run, pending };
}
