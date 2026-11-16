import { cn } from "@/lib/utils";

/**
 * Login.png form card: 388 wide, 24 padding (32 bottom), "Hello!" (32 black) over
 * a 18px subtitle, 20 above the fields. Mobile (430 frames): no card chrome; the
 * white panel around it is the surface.
 */
export function AuthCard({
  title = "Hello!",
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full tablet:max-w-97 tablet:rounded-xl tablet:border tablet:border-border tablet:bg-card tablet:p-6 tablet:pb-8 tablet:shadow-modal",
        className,
      )}
    >
      <h1 className="text-[2rem] leading-tight font-black text-foreground">{title}</h1>
      <p className="mt-2 text-lg text-foreground">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** "Don't have account? Register" row under the button (14px, link in foreground). */
export function AuthSwitch({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <p className="mt-5 text-center text-copy text-muted-foreground">
      {prompt} <span className="font-medium text-foreground">{children}</span>
    </p>
  );
}

/** Admin auth fields: white, 49 high, 8 radius (overrides the storefront TextInput look). */
export const adminInputClass = "rounded-lg bg-card";

/** Admin primary button (Login / Create Account): 48 high, 8 radius, full width. */
export const adminSubmitClass = "mt-5 h-12 w-full rounded-lg text-lead font-bold hover:bg-primary-hover laptop:h-12";
