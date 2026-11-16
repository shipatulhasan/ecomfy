import { cn } from "@/lib/utils";

/** Add Products.png input: 48 high, muted fill, 8 radius, 16 text. */
export const fieldInput =
  "h-12 w-full min-w-0 rounded-lg border border-border bg-muted px-3 text-lead text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-primary/15 disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

export function FieldError({ id, message, className }: { id?: string; message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn("text-caption text-destructive", className)}>
      {message}
    </p>
  );
}

/** Label (18 high, 16 medium) over the control, 12 apart, error underneath. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <label id={`${id}-label`} htmlFor={id} className="text-lead font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="-mt-1.5 text-caption text-muted-foreground">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} className="-mt-1.5" />
    </div>
  );
}

/** Add Products.png card: white, 12 radius, 24 padding. */
export function FormCard({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("min-w-0 rounded-xl bg-card p-4 tablet:p-6", className)} {...props}>
      {children}
    </section>
  );
}
