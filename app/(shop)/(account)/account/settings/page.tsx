import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/shared/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountSettingsCard,
  BillingAddressForm,
  ChangePasswordForm,
} from "@/components/shop/account/settings-forms";
import { requireUser } from "@/lib/auth-guards";
import { getAccountProfile, getDefaultBillingAddress } from "@/lib/queries/account";

/**
 * Settings (designs/screens/web/Settings.png): Account Settings (+ photo), Billing
 * Address, Change Password, 24 apart. The billing form is Bangladesh-first like
 * checkout: District / Area / Postcode take the PNG's Country / States / Zip slots.
 */
export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageTransition>
      <h1 className="text-h3 text-foreground laptop:sr-only">Settings</h1>
      <div className="mt-4 flex flex-col gap-6 laptop:mt-0">
        <Suspense fallback={<SettingsSkeleton />}>
          <SettingsSections />
        </Suspense>
        <ChangePasswordForm />
      </div>
    </PageTransition>
  );
}

async function SettingsSections() {
  const user = await requireUser();
  const [profile, address] = await Promise.all([getAccountProfile(user.id), getDefaultBillingAddress(user.id)]);
  if (!profile) return null;
  const [firstName = "", ...rest] = profile.name.trim().split(/\s+/);
  return (
    <>
      <AccountSettingsCard
        firstName={firstName}
        lastName={rest.join(" ")}
        email={profile.email}
        phone={profile.phone ?? ""}
        name={profile.name}
        image={profile.image}
      />
      <BillingAddressForm address={address} fallbackEmail={profile.email} />
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="flex flex-col gap-6">
      <Skeleton className="h-133 rounded-lg" />
      <Skeleton className="h-133 rounded-lg" />
    </div>
  );
}
