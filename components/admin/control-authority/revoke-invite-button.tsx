"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { revokeInviteAction } from "@/lib/actions/admin-invites";

export function RevokeInviteButton({ id, email }: { id: string; email: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await revokeInviteAction({ id });
          if (res.ok) toast.success(`Invite for ${email} revoked.`);
          else toast.error(res.error);
        })
      }
      className="tap-target rounded-md px-3 py-1.5 text-copy font-bold text-destructive hover:bg-sale-soft disabled:opacity-60"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
