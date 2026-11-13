"use client";

import { useSearchParams } from "next/navigation";
import { safeCallbackUrl } from "@/lib/callback-url";

/** `?callbackUrl=` (same-site only, else /account) plus the raw params for notices. */
export function useAuthParams() {
  const params = useSearchParams();
  return { callbackUrl: safeCallbackUrl(params.get("callbackUrl")), params };
}

/** Carry the callback over to the other auth page ("Register" / "Login" links). */
export function withCallback(path: string, callbackUrl: string): string {
  return callbackUrl === "/account" ? path : `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
