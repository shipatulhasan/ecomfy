"use client";

import { ChevronRightIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Add Members.png / Create New Role.png input: 48 high, muted fill. */
export const drawerField =
  "h-12.25 w-full min-w-0 rounded-lg border border-border bg-muted px-4 text-copy text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive";

export const drawerPrimary =
  "press inline-flex h-11.25 items-center justify-center gap-2 rounded-lg bg-primary text-copy font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-75";

/**
 * The Control Authority right drawer (Add Members.png, Create New Role.png):
 * 400 wide from tablet, full width on mobile. The form inside is its own
 * component, so its state starts fresh each time the drawer opens.
 */
export function DrawerFrame({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full! max-w-none! gap-0 bg-card p-0 tablet:w-100!">
        {children}
      </SheetContent>
    </Sheet>
  );
}

/** "Control Authority › {title}" breadcrumb, title, scrolling body, Close (outlined red) + primary footer. */
export function DrawerForm({
  title,
  description,
  onSubmit,
  onClose,
  primary,
  formRef,
  children,
}: {
  title: string;
  description: string;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  primary: React.ReactNode;
  formRef?: React.Ref<HTMLFormElement>;
  children: React.ReactNode;
}) {
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-7.5 pt-14 pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-lead text-muted-foreground">
          Control Authority <ChevronRightIcon aria-hidden className="size-4" />
          <span className="text-primary">{title}</span>
        </nav>
        <SheetTitle className="mt-6 text-h1 font-bold text-foreground">{title}</SheetTitle>
        <SheetDescription className="sr-only">{description}</SheetDescription>
        <div className="mt-5 flex flex-col gap-5">{children}</div>
      </div>
      <div className="grid grid-cols-2 gap-4 px-7.5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="press h-11.25 rounded-lg border border-destructive text-copy font-bold text-destructive hover:bg-sale-soft">
          Close
        </button>
        {primary}
      </div>
    </form>
  );
}

export function DrawerField({ label, id, error, children, className }: { label: string; id?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {id ? (
        <label htmlFor={id} className="text-lead text-foreground">
          {label}
        </label>
      ) : (
        <p className="text-lead text-foreground">{label}</p>
      )}
      {children}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
