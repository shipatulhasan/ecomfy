"use client";

import { cn } from "@/lib/utils";

/**
 * Strength hint under new-password fields. A nudge only: the server rule is just
 * "at least 8 characters" (lib/validations/auth.ts).
 */
function score(pw: string): number {
  if (pw.length < 8) return pw.length === 0 ? 0 : 1;
  let s = 2;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const labels = ["", "Too short", "Fair", "Good", "Strong"] as const;
const bar = ["", "bg-sale", "bg-warning", "bg-primary", "bg-brand-dark"] as const;

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const s = score(password);
  return (
    <div id={id} aria-live="polite" className={cn("flex items-center gap-3", s === 0 && "invisible")}>
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 rounded-full", i <= s ? bar[s] : "bg-muted-strong")} />
        ))}
      </div>
      <span className="w-18 text-right text-caption text-text-subtle">{s > 0 && labels[s]}</span>
    </div>
  );
}
