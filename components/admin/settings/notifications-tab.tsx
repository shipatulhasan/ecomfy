"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_KEYS, NOTIFICATION_LABELS, type NotificationKey } from "@/lib/admin/notifications";
import { saveNotificationsAction } from "@/lib/actions/admin-account";
import { SectionActions, SectionError, SettingsCard, useSection } from "./section";

/** Notifications (derived tab): per-user email toggles, stored in User.notificationPrefs. */
export function NotificationsTab({ prefs, email }: { prefs: Record<NotificationKey, boolean>; email: string }) {
  const s = useSection(prefs, saveNotificationsAction);
  return (
    <SettingsCard title="Email notifications" description={`Sent to ${email}. Only you see and change these.`} className="laptop:max-w-184">
      <form onSubmit={s.submit} className="flex flex-col gap-5">
        <SectionError message={s.formError} />
        <ul className="flex flex-col divide-y divide-border">
          {NOTIFICATION_KEYS.map((k) => (
            <li key={k}>
              <Label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 py-3 font-normal">
                <span className="flex flex-col gap-0.5">
                  <span className="text-lead text-foreground">{NOTIFICATION_LABELS[k].label}</span>
                  <span className="text-copy text-muted-foreground">{NOTIFICATION_LABELS[k].hint}</span>
                </span>
                <Switch checked={s.values[k]} onCheckedChange={(v) => s.set(k, v)} />
              </Label>
            </li>
          ))}
        </ul>
        <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
      </form>
    </SettingsCard>
  );
}
