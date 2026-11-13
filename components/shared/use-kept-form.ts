"use client";

import { startTransition, useActionState } from "react";
import type { ActionResult } from "@/lib/actions/result";

/**
 * useActionState for forms that must keep what the user typed after a failed
 * submit. A form `action` resets every uncontrolled field (checkboxes, passwords)
 * once the action settles; submitting from onSubmit inside a transition doesn't.
 * Server-side redirects (sign in → callbackUrl) still happen as usual.
 *
 *   const { state, pending, onSubmit, err } = useKeptForm(signInAction);
 *   <form onSubmit={onSubmit}>…{err("email")}…</form>
 */
export function useKeptForm<T>(action: (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T> | null>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  /** Form-level error (no field errors): wrong password, rate limited, … */
  const formError = state && !state.ok && !state.fieldErrors ? state.error : null;
  return { state, pending, onSubmit, errors, formError, err: (k: string) => errors?.[k]?.[0] };
}
