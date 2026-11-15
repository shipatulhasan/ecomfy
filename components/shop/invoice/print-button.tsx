"use client";

import { PrinterIcon } from "lucide-react";
import { useEffect } from "react";

/** "Print / Save as PDF" on the invoice page; `auto` opens the print dialog once (?print=1). */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 300); // let fonts and images settle
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="press inline-flex h-11.25 items-center gap-2 rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground hover:bg-brand-dark print:hidden"
    >
      <PrinterIcon aria-hidden className="size-4" />
      Print / Save as PDF
    </button>
  );
}
