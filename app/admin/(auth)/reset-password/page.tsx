import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminResetPasswordForm } from "@/components/admin/auth/admin-password-forms";
import { AuthCard } from "@/components/admin/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Reset password" };

/** No PNG: the emailed link (/admin/reset-password?token=…) lands here. */
export default function AdminResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  return (
    <AuthCard title="New password" subtitle="Choose a new password for your account">
      <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
        <ResetForm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function ResetForm({ searchParams }: Pick<PageProps<"/admin/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || !token || error) {
    return (
      <p role="alert" className="text-copy text-text-body">
        This reset link is invalid or has expired.{" "}
        <Link href="/admin/forgot-password" className="font-bold text-primary hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }
  return <AdminResetPasswordForm token={token} />;
}
