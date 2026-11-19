"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";

/**
 * The URL-driven Transaction detail sheet (?txn=<id>): a right side sheet from
 * laptop up, a bottom sheet below (ResponsiveModal, CSS only, so a fresh load with
 * ?txn= opens it). Closing drops `txn` from the URL and keeps the list state.
 */
export function TxnSheetFrame({
  closeHref,
  title,
  description,
  footer,
  children,
}: {
  closeHref: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  // Open once the page has finished streaming and hydrating: an open Radix dialog
  // marks the rest of the page aria-hidden, which breaks hydration of boundaries
  // still streaming in beside it (a fresh load with ?txn=). Client clicks open at once.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Idle after load: React hydrates the remaining boundaries first.
    // (Safari has no requestIdleCallback: a short timeout instead.)
    let cancel = () => {};
    const go = () => {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => setReady(true), { timeout: 800 });
        cancel = () => window.cancelIdleCallback(id);
      } else {
        const id = setTimeout(() => setReady(true), 200);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      cancel();
    };
  }, []);
  return (
    <ResponsiveModal
      open={ready && !closed}
      placement="right"
      className="laptop:max-w-xl"
      title={title}
      description={description}
      footer={footer}
      onOpenChange={(next) => {
        if (next) return;
        setClosed(true); // close now; the URL catches up
        router.replace(closeHref, { scroll: false });
      }}
    >
      {children}
    </ResponsiveModal>
  );
}
