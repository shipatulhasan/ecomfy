"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEMBER_STATUS_LABEL, MEMBER_STATUSES, teamHref, type TeamParams } from "@/lib/admin/team/params";
import { cn } from "@/lib/utils";

const ALL = "__all";

/** All members toolbar: status pills, debounced search (?q=), role filter (?mrole=). */
export function MembersToolbar({ params, roles }: { params: TeamParams; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [urlQ, setUrlQ] = useState(params.q);
  if (urlQ !== params.q) {
    setUrlQ(params.q);
    setQ(params.q);
  }

  const go = (href: string) => startTransition(() => router.replace(href, { scroll: false }));
  const pushQuery = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value.trim() !== params.q) go(teamHref(params, { q: value.trim() }));
    }, 300);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 laptop:flex-nowrap">
      <nav aria-label="Member status" className="flex max-w-full overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none]">
        {MEMBER_STATUSES.map((s) => {
          const active = params.status === s;
          return (
            <Link
              key={s}
              href={teamHref(params, { status: s })}
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap-target inline-flex h-8 shrink-0 items-center rounded-md px-3 text-lead whitespace-nowrap transition-colors laptop:px-4",
                active ? "bg-card font-medium text-foreground shadow-sm" : "text-text-body hover:text-foreground",
              )}
            >
              {MEMBER_STATUS_LABEL[s]}
            </Link>
          );
        })}
      </nav>
      <search className="relative min-w-0 flex-1 basis-full tablet:basis-auto laptop:ml-auto laptop:max-w-78" aria-busy={pending}>
        <label htmlFor="member-search" className="sr-only">
          Search members by name or email
        </label>
        <input
          id="member-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            pushQuery(e.target.value);
          }}
          placeholder="Search members"
          autoComplete="off"
          className="h-10 w-full rounded-lg bg-muted pr-11 pl-3 text-copy text-foreground outline-none placeholder:text-text-body focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
        />
        <SearchIcon aria-hidden className={cn("pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 stroke-[1.5] text-foreground", pending && "animate-pulse")} />
      </search>
      <Select value={params.mrole ?? ALL} onValueChange={(v) => go(teamHref(params, { mrole: v === ALL ? null : v }))}>
        <SelectTrigger aria-label="Filter by role" className="h-10! w-full rounded-lg bg-card tablet:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roles</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
