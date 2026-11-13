"use client";

import { useFormStatus } from "react-dom";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

/** Log-out (account nav + mobile menu): a form posting the sign-out server action. */
export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form action={signOutAction} className="contents">
      <Inner className={className}>{children}</Inner>
    </form>
  );
}

function Inner({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(pending && "animate-pulse", className)}>
      {children}
    </button>
  );
}
