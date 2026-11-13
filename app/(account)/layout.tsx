import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth-guards";

// Customer account area (dashboard, order history, wishlist, settings).
// The session read sits inside <Suspense>, as Cache Components requires.
// Layout rule: account nav is a sidebar on laptop/desktop and a Sheet below.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="flex-1 py-section">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <SignedIn>{children}</SignedIn>
      </Suspense>
    </Container>
  );
}

async function SignedIn({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
