"use client";

import { useState } from "react";
import { GoogleIcon } from "@/components/shared/social-icons";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * "Continue with Google" (not in the PNGs; rendered only when Google is configured,
 * see app/(shop)/(auth)). Better Auth runs the OAuth redirect; on return the after-hook
 * merges the guest cart and the user lands on `callbackUrl`.
 */
export function GoogleButton({ callbackUrl, className }: { callbackUrl: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl,
      newUserCallbackURL: callbackUrl,
      errorCallbackURL: "/sign-in?error=google",
    });
    if (error) {
      setPending(false);
      setError("Google sign-in isn't available right now. Please use your email.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3 text-caption text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        aria-busy={pending || undefined}
        className={cn(
          "press inline-flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-background px-6 text-copy font-medium text-foreground transition-colors hover:border-primary disabled:opacity-75 laptop:h-11.25",
          pending && "animate-pulse",
        )}
      >
        <GoogleIcon aria-hidden className="size-5" />
        Continue with Google
      </button>
      {error && (
        <p role="alert" className="text-center text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
