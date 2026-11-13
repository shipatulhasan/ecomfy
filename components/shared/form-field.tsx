import { cn } from "@/lib/utils";

/**
 * Storefront form controls (Sign In / Create Account / Settings / Checkout):
 * 49 design-px fields, 6px radius, 16px placeholder, primary border on focus.
 * Plain markup with no hooks, so server and client forms share them.
 */
export const inputClass =
  "h-12.25 w-full min-w-0 rounded-md border border-border bg-background px-4 text-lead text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/15";

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="text-input" className={cn(inputClass, className)} {...props} />;
}

/**
 * Label (visible, or screen-reader only for the placeholder-style auth forms),
 * control, and the field's error under it. Pass the control's id as `htmlFor`
 * and `errorId` as its aria-describedby.
 */
export function FormField({
  label,
  htmlFor,
  error,
  errorId,
  hideLabel,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId?: string;
  hideLabel?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={cn("text-copy text-foreground", hideLabel && "sr-only")}>
        {label}
        {optional && <span className="text-muted-foreground"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-caption text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level message (error or success) above the submit button. */
export function FormAlert({ tone, children, className }: { tone: "error" | "success"; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md px-4 py-3 text-copy",
        tone === "error" ? "bg-sale-soft text-sale" : "bg-success-soft text-brand-dark",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Green pill submit (45 design-px). `pending` keeps the label but shows progress text. */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  ...props
}: { pending: boolean; pendingLabel: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "press inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-75 laptop:h-11.25",
        pending && "animate-pulse",
        className,
      )}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
