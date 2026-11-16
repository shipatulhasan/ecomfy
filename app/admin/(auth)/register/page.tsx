import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminRegisterForm } from "@/components/admin/auth/admin-register-form";
import { AuthCard } from "@/components/admin/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { findUsableInvite } from "@/lib/admin/invites";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Register" };

/**
 * Register.png, invite only. A valid ?token= shows the form with the invited
 * email fixed; no token, or an unknown / used / revoked / expired one, shows the
 * error state in the same card, never the form.
 */
export default function AdminRegisterPage({ searchParams }: PageProps<"/admin/register">) {
  return (
    <AuthCard subtitle="Sign Up to Get Started">
      <Suspense fallback={<RegisterSkeleton />}>
        <InviteGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function InviteGate({ searchParams }: Pick<PageProps<"/admin/register">, "searchParams">) {
  await connection(); // request-time: the expiry check reads the clock
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : null;
  const invite = await findUsableInvite(prisma, token);
  if (!invite || !token) return <InvalidInvite hadToken={Boolean(token)} />;
  return <AdminRegisterForm token={token} email={invite.email} />;
}

function InvalidInvite({ hadToken }: { hadToken: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <span className="grid size-12 place-items-center rounded-full bg-sale-soft text-sale">
        <LinkIcon aria-hidden className="size-6" />
      </span>
      <p className="text-h3 text-foreground">{hadToken ? "This invitation link can't be used" : "Registration is by invitation"}</p>
      <p className="text-copy text-text-body">
        {hadToken
          ? "It's invalid, has already been used, or has expired (links last 48 hours). Ask an admin to send you a new invite."
          : "Admin accounts are created from an invitation link. Ask an admin to invite you, then open the link from your email."}
      </p>
      <Link
        href="/admin/login"
        className="press mt-2 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-lead font-bold text-primary-foreground hover:bg-primary-hover"
      >
        Go to Login
      </Link>
    </div>
  );
}

function RegisterSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12.25 w-full rounded-lg" />
      ))}
      <Skeleton className="mt-1 h-5 w-56" />
      <Skeleton className="mt-5 h-12 w-full rounded-lg" />
    </div>
  );
}
