import { z } from "zod";

/**
 * Admin email notification toggles (General Info → Notifications), stored per
 * user in User.notificationPrefs. Senders call wantsNotification() before mailing
 * a staff member.
 */
export const NOTIFICATION_KEYS = ["newOrder", "codOrder", "lowStock", "paymentAttention", "newReview"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export const NOTIFICATION_LABELS: Record<NotificationKey, { label: string; hint: string }> = {
  newOrder: { label: "New order", hint: "Every paid or confirmed order." },
  codOrder: { label: "Cash on delivery order", hint: "COD orders waiting to be confirmed." },
  lowStock: { label: "Low stock", hint: "A product drops to its low-stock threshold." },
  paymentAttention: { label: "Payment needs attention", hint: "Gateway mismatches and stuck payments." },
  newReview: { label: "New review", hint: "A customer reviews a product." },
};

export const DEFAULT_NOTIFICATIONS: Record<NotificationKey, boolean> = {
  newOrder: true,
  codOrder: true,
  lowStock: true,
  paymentAttention: true,
  newReview: false,
};

export const notificationPrefsSchema = z.object(
  Object.fromEntries(NOTIFICATION_KEYS.map((k) => [k, z.boolean()])) as Record<NotificationKey, z.ZodBoolean>,
);

/** Stored JSON (possibly partial / old) → full prefs with defaults. */
export function readNotificationPrefs(json: unknown): Record<NotificationKey, boolean> {
  const obj = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return Object.fromEntries(
    NOTIFICATION_KEYS.map((k) => [k, typeof obj[k] === "boolean" ? (obj[k] as boolean) : DEFAULT_NOTIFICATIONS[k]]),
  ) as Record<NotificationKey, boolean>;
}

export const wantsNotification = (user: { notificationPrefs: unknown }, key: NotificationKey) => readNotificationPrefs(user.notificationPrefs)[key];
