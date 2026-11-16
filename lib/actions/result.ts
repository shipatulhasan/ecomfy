/** Every server action returns this shape — never throws to the client. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Throw inside an action to return a user-facing error message. */
export class ActionError extends Error {
  /** Optional per-field messages (dotted paths for nested fields: "variants.0.sku"). */
  fieldErrors?: Record<string, string[]>;
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** `error` value of actions that need a session; the client sends the visitor to sign in. */
export const SIGN_IN_REQUIRED = "SIGN_IN_REQUIRED";

/** `error` value of admin actions the signed-in staff member isn't permitted to run (a 403). */
export const FORBIDDEN = "You don't have permission to do that.";
