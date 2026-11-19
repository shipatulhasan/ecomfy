"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { verifyPaymentWithGateway } from "@/lib/actions/admin-payments";

/** "Verify with gateway" (payments:reconcile): asks bKash / SSLCommerz and settles the row if it differs. */
export function VerifyButton({ id, className }: { id: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          const r = await verifyPaymentWithGateway({ id });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          if (r.data.changed) toast.success(r.data.message);
          else toast.info(r.data.message);
        })
      }
    >
      <ShieldCheckIcon aria-hidden />
      {pending ? "Checking with the gateway…" : "Verify with gateway"}
    </Button>
  );
}
