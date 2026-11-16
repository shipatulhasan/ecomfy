import Link from "next/link";
import { ShieldAlertIcon } from "@/components/admin/icons";
import { Container } from "@/components/shared/container";

/**
 * 403 inside the shell: the staff member is signed in but lacks the permission
 * (forbidden() is still experimental in Next 16.4, so pages render this instead).
 */
export function Forbidden() {
  return (
    <Container variant="admin" className="py-section">
      <div
        role="alert"
        className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-16 text-center"
      >
        <span className="grid size-14 place-items-center rounded-full bg-sale-soft text-sale">
          <ShieldAlertIcon aria-hidden className="size-7" />
        </span>
        <p className="text-caption font-bold tracking-wide text-sale uppercase">403 · No access</p>
        <h2 className="text-h2 text-foreground">You don&apos;t have permission to view this page</h2>
        <p className="max-w-md text-copy text-muted-foreground">Ask an admin to change your role if you need it.</p>
        <Link href="/admin" className="tap-target mt-2 text-copy font-bold text-primary hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </Container>
  );
}
