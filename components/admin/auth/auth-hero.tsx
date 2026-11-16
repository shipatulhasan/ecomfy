import { AdminLogo } from "@/components/admin/admin-logo";

/**
 * Login.png / Register.png left panel (860 of 1440): green gradient, two outline
 * circles bottom-left, a frosted card (660×249, centered) with two small frosted
 * squares overlapping its top-left and bottom-right corners, logo + pitch inside.
 *
 * - mobile (430 frames): the same card, smaller (341×169), on the gradient above the form panel;
 * - tablet: hidden (the form card sits on the gradient alone, DESIGN.md);
 * - laptop+: the full panel; the card shrinks with the panel on narrow laptops.
 */
export function AuthHero() {
  return (
    <section
      aria-label="Ecofy admin"
      className="relative flex items-center justify-center overflow-hidden px-12 pt-[max(4rem,env(safe-area-inset-top))] pb-16 tablet:hidden laptop:flex laptop:min-h-svh laptop:bg-linear-to-b laptop:from-auth-hero-from laptop:to-auth-hero-to laptop:py-16"
    >
      <Circles />
      <div className="relative w-full max-w-85.25 laptop:max-w-165">
        <Glass className="-top-5.75 -left-6.25 size-12.5 rounded-xl laptop:-top-10.75 laptop:-left-12.25 laptop:size-24.25 laptop:rounded-3xl" />
        <Glass className="-right-4 -bottom-5 size-12.5 rounded-xl laptop:-right-8 laptop:-bottom-7.75 laptop:size-24.25 laptop:rounded-3xl" />
        <div className="relative rounded-2xl border border-primary-foreground/25 bg-linear-to-br from-primary-foreground/25 via-primary-foreground/10 to-primary-foreground/5 px-4.5 pt-4 pb-5 backdrop-blur-md laptop:min-h-62.25 laptop:rounded-4xl laptop:px-8.5 laptop:pt-11 laptop:pb-12">
          <AdminLogo size="hero-sm" className="laptop:hidden" />
          <AdminLogo size="hero" className="hidden laptop:inline-flex" />
          <p className="mt-2 text-lead font-bold text-primary-foreground laptop:mt-3.5 laptop:text-xl">
            Easy-to-Use Dashboard for Managing Your Business.
          </p>
          <p className="mt-2 text-caption text-primary-foreground/90 laptop:mt-4 laptop:text-copy">
            Streamline Your Business Management with Our User-Friendly Dashboard. Simplify complex tasks, track key
            metrics, and make informed decisions effortlessly
          </p>
        </div>
      </div>
    </section>
  );
}

function Glass({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute border border-primary-foreground/25 bg-linear-to-br from-primary-foreground/30 to-primary-foreground/5 backdrop-blur-sm ${className}`}
    />
  );
}

/** Two 557 design-px outline circles, clipped at the bottom-left corner. */
export function Circles({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className="absolute -bottom-[7.9rem] -left-[3.6rem] size-[15.7rem] rounded-full border border-primary-foreground/50 laptop:-bottom-[17.3rem] laptop:-left-[7.9rem] laptop:size-[34.8rem]" />
      <span className="absolute -bottom-[6.6rem] -left-[5.9rem] size-[15.7rem] rounded-full border border-primary-foreground/50 laptop:-bottom-[15.6rem] laptop:-left-[12.9rem] laptop:size-[34.8rem]" />
    </span>
  );
}
