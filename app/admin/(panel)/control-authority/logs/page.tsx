import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ListPagination } from "@/components/admin/products/list/pagination";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDhaka } from "@/lib/admin/date-range";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getSecurityLogs } from "@/lib/queries/admin/team";

export const metadata: Metadata = { title: "Security Logs" };

/**
 * "View Security Logs" (Add Members.png; no design for the page): team, role,
 * invite and store-settings audit entries, newest first, 25 per page; each row
 * expands to its before / after JSON. Admin kit only (white card, mint header).
 */
export default function SecurityLogsPage({ searchParams }: PageProps<"/admin/control-authority/logs">) {
  return (
    <Suspense fallback={<LogsSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/control-authority/logs">, "searchParams">) {
  const user = await requireStaff("/admin/control-authority/logs");
  if (!can(user, "users:manage")) return <Forbidden />;
  const raw = (await searchParams).page;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(Array.isArray(raw) ? raw[0]! : (raw ?? "1"), 10) || 1));
  const { rows, pages, total } = await getSecurityLogs(page);

  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">Security Logs</h2>
        <Link
          href="/admin/control-authority"
          transitionTypes={["nav-back"]}
          className="tap-target inline-flex items-center gap-1 rounded-md px-2 text-copy text-primary hover:bg-secondary"
        >
          <ArrowLeftIcon aria-hidden className="size-4" /> Control Authority
        </Link>
      </div>
      <section className="rounded-xl bg-card p-4 tablet:p-6">
        <p className="mb-4 text-copy text-muted-foreground">
          {total.toLocaleString("en-US")} entries: team members, roles, invites and store settings.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-lg bg-muted px-4 py-8 text-center text-copy text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="group py-3">
                  <summary className="tap-target flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 hover:bg-muted [&::-webkit-details-marker]:hidden">
                    <code className="rounded bg-secondary px-2 py-0.5 text-caption font-bold text-secondary-foreground">{r.action}</code>
                    <span className="min-w-0 flex-1 truncate text-copy text-foreground">
                      {r.actor?.name ?? "System / CLI"}
                      {r.entityId && <span className="text-muted-foreground"> · {r.entity} {r.entityId.slice(0, 12)}</span>}
                    </span>
                    <time dateTime={r.createdAt.toISOString()} className="text-caption text-muted-foreground">
                      {formatDhaka(r.createdAt, "dd MMM yyyy, h:mm a")}
                    </time>
                  </summary>
                  <div className="mt-3 grid gap-3 px-2 laptop:grid-cols-2">
                    <Json label="Before" value={r.before} />
                    <Json label="After" value={r.after} />
                    <p className="text-caption text-muted-foreground laptop:col-span-2">
                      {r.actor?.email ?? "No actor"} · IP {r.ip ?? "unknown"}
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <ListPagination page={page} pages={pages} href={(n) => `/admin/control-authority/logs${n > 1 ? `?page=${n}` : ""}`} />
      </section>
    </Container>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-caption font-bold text-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-caption text-text-body">{value == null ? "—" : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function LogsSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <Skeleton className="h-11 w-60" />
      <Skeleton className="h-120 rounded-xl" />
    </Container>
  );
}
