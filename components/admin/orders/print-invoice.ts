"use client";

import { toast } from "sonner";

/**
 * Print invoices without leaving the page: the print route (same InvoiceSheet as
 * the customer's invoice) loads in a hidden iframe and the browser's print
 * dialog opens straight away ("Save as PDF" there for a PDF). The standalone
 * pages (/admin/orders/[n]/invoice, /admin/orders/invoices?n=…) still work on
 * their own.
 */
export const invoiceHref = (number: number) => `/admin/orders/${number}/invoice`;
export const invoicesHref = (query: string) => `/admin/orders/invoices${query ? `?${query}` : ""}`;

let busy = false;

export function printInvoice(href: string) {
  if (busy) return;
  busy = true;
  const loading = toast("Preparing invoice…");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Off-screen but laid out at A4-ish width, so the print matches the page.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "800px", height: "1200px", border: "0" });

  const cleanup = () => {
    busy = false;
    toast.dismiss(loading);
    setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    // Signed out / forbidden / not found: the frame isn't an invoice.
    if (!win || !doc?.querySelector("article")) {
      cleanup();
      toast.error("Couldn't load the invoice. Open the order and try again.");
      return;
    }
    // Let the logo and fonts settle, then print the frame (not the admin page).
    // print() returns once the dialog closes, so the frame can go right after.
    void doc.fonts?.ready.then(() => {
      toast.dismiss(loading);
      win.focus();
      win.print();
      cleanup();
    });
  };
  frame.src = href;
  document.body.appendChild(frame);
}
