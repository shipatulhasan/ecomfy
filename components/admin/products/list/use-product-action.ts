"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Runs a product server action from the list: toast on error, success message,
 * then refresh the server-rendered rows. `pending` drives button states.
 */
export function useProductAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = <T,>(action: () => Promise<ActionResult<T>>, success: (data: T) => string, after?: (data: T) => void) =>
    new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const res = await action();
        if (!res.ok) {
          toast.error(res.error);
          resolve(false);
          return;
        }
        toast.success(success(res.data));
        after?.(res.data);
        router.refresh();
        resolve(true);
      });
    });

  return { run, pending };
}
