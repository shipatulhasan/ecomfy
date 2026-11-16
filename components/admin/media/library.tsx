"use client";

import { CircleXIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DeleteDialog } from "@/components/admin/products/list/row-actions";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteMedia, updateMediaAlt } from "@/lib/actions/admin-media";
import type { MediaItem } from "@/lib/admin/media";
import type { MediaListParams } from "@/lib/queries/admin/products";
import { cn } from "@/lib/utils";
import { AddImageTile, UploadTaskTile } from "./upload-tile";
import { useUploader } from "./use-uploader";

const tile = "aspect-213/215 rounded-xl";

function href(p: MediaListParams, patch: Partial<MediaListParams>) {
  const n = { ...p, page: 1, ...patch };
  const s = new URLSearchParams();
  if (n.q) s.set("q", n.q);
  if (n.used) s.set("used", n.used);
  if (n.page > 1) s.set("page", String(n.page));
  const qs = s.toString();
  return `/admin/media${qs ? `?${qs}` : ""}`;
}

export function MediaLibrary({
  params,
  items,
  total,
  pages,
  maxMb,
}: {
  params: MediaListParams;
  items: MediaItem[];
  total: number;
  pages: number;
  maxMb: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [urlQ, setUrlQ] = useState(params.q);
  if (urlQ !== params.q) {
    setUrlQ(params.q);
    setQ(params.q);
  }

  const uploader = useUploader({ scope: "library", maxMb, onUploaded: () => router.refresh() });

  const deletable = items.filter((m) => !m.usedBy?.length);
  const live = new Set([...selected].filter((id) => deletable.some((m) => m.id === id)));

  const remove = (ids: string[]) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await deleteMedia({ ids });
        if (!res.ok) {
          toast.error(res.error);
          return resolve(false);
        }
        toast.success(`Deleted ${res.data.deleted} image${res.data.deleted === 1 ? "" : "s"}`);
        setSelected(new Set());
        router.refresh();
        resolve(true);
      }),
    );

  const filters: { label: string; used: MediaListParams["used"] }[] = [
    { label: "All", used: null },
    { label: "Used", used: "used" },
    { label: "Unused", used: "unused" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center">
        <search className="relative tablet:w-90">
          <label htmlFor="media-search" className="sr-only">
            Search media by file name or alt text
          </label>
          <input
            id="media-search"
            type="search"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => router.replace(href(params, { q: v.trim() }), { scroll: false }), 300);
            }}
            placeholder="Search media"
            className="h-10 w-full rounded-lg border border-border bg-card pr-10 pl-3 text-copy outline-none focus-visible:border-primary"
          />
          <SearchIcon aria-hidden className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-foreground" />
        </search>
        <nav aria-label="Filter media" className="flex gap-1 rounded-lg bg-card p-1">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={href(params, { used: f.used })}
              replace
              scroll={false}
              aria-current={params.used === f.used ? "page" : undefined}
              className={cn(
                "tap-target rounded-md px-3 py-1.5 text-copy text-text-body hover:text-foreground",
                params.used === f.used && "bg-secondary font-bold text-secondary-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <p className="text-copy text-muted-foreground tablet:ml-auto">
          {total} image{total === 1 ? "" : "s"}
        </p>
      </div>

      {live.size > 0 && (
        <div role="region" aria-label="Selection" className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
          <span className="mr-auto text-copy font-bold text-foreground">{live.size} selected</span>
          <Button variant="outline" className="h-10 px-4" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button variant="destructive" className="h-10 px-4" disabled={pending} onClick={() => setConfirm([...live])}>
            Delete
          </Button>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-4 desktop:grid-cols-5">
        {items.map((m) => {
          const used = Boolean(m.usedBy?.length);
          const on = live.has(m.id);
          return (
            <li key={m.id} className={cn("group relative overflow-hidden border-2 bg-card", tile, on ? "border-primary" : "border-border")}>
              <button
                type="button"
                onClick={() => setEditing(m)}
                aria-label={`${m.alt || m.originalName}. ${used ? `Used by ${m.usedBy!.map((p) => p.name).join(", ")}` : "Not used"}. Edit details`}
                className="absolute inset-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <Image
                  src={m.url}
                  alt=""
                  fill
                  sizes="(width >= 90rem) 213px, (width >= 64rem) 22vw, (width >= 48rem) 30vw, 45vw"
                  placeholder={m.blurDataURL ? "blur" : "empty"}
                  blurDataURL={m.blurDataURL ?? undefined}
                  className="object-contain p-6"
                />
              </button>
              {!used && (
                <label className="absolute top-2.5 left-2.5 grid size-8 place-items-center rounded-md bg-card/90 opacity-100 laptop:opacity-0 laptop:group-hover:opacity-100 laptop:has-checked:opacity-100 laptop:focus-within:opacity-100">
                  <Checkbox
                    aria-label={`Select ${m.originalName}`}
                    checked={on}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (v === true) n.add(m.id);
                        else n.delete(m.id);
                        return n;
                      })
                    }
                    className="size-5"
                  />
                </label>
              )}
              {used ? (
                <span className="absolute bottom-2 left-2 rounded-full bg-secondary px-2 py-0.5 text-caption font-medium text-secondary-foreground">
                  In use · {m.usedBy!.length}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm([m.id])}
                  aria-label={`Delete ${m.originalName}`}
                  className="tap-target absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full text-text-body hover:text-sale"
                >
                  <CircleXIcon aria-hidden className="size-8.5 stroke-[1.25]" />
                </button>
              )}
            </li>
          );
        })}
        {uploader.tasks.map((t) => (
          <li key={t.id}>
            <UploadTaskTile task={t} className={cn(tile, "w-full")} onCancel={() => uploader.cancel(t.id)} onRetry={() => uploader.retry(t.id)} onDismiss={() => uploader.dismiss(t.id)} />
          </li>
        ))}
        <li>
          <AddImageTile onFiles={(f) => uploader.addFiles(f)} className={cn(tile, "w-full")} />
        </li>
      </ul>

      {items.length === 0 && (
        <p className="text-copy text-muted-foreground">{params.q || params.used ? "No images match." : "No images yet. Add the first one."}</p>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={href(params, { page: n })}
              aria-current={n === params.page ? "page" : undefined}
              className={cn("tap-target grid size-9 place-items-center rounded-md border border-border text-copy", n === params.page && "border-accent bg-accent font-bold")}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}

      <DeleteMediaDialog ids={confirm} items={items} onClose={() => setConfirm(null)} onConfirm={remove} />
      {editing && <MediaDetails key={editing.id} item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DeleteMediaDialog({
  ids,
  items,
  onClose,
  onConfirm,
}: {
  ids: string[] | null;
  items: MediaItem[];
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<boolean>;
}) {
  const names = (ids ?? []).map((id) => items.find((m) => m.id === id)?.originalName ?? "image");
  return <DeleteDialog open={ids !== null} onOpenChange={(o) => !o && onClose()} names={names} onConfirm={() => onConfirm(ids ?? [])} kind="media" />;
}

/** Tap a tile: details, products using it, alt text. */
function MediaDetails({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const router = useRouter();
  const [alt, setAlt] = useState(item.alt);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await updateMediaAlt({ id: item.id, alt });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Alt text saved");
      router.refresh();
      onClose();
    });

  return (
    <AdaptiveSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={item.originalName}
      description={`${item.width}×${item.height} · ${(item.size / 1024).toFixed(0)} KB · ${item.mime.replace("image/", "").toUpperCase()}`}
      trigger={<span hidden />}
      footer={
        <Button className="h-11 w-full" disabled={pending || alt === item.alt} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
          <Image src={item.url} alt={item.alt} fill sizes="(width >= 64rem) 420px, 100vw" className="object-contain p-4" />
        </div>
        <label className="flex flex-col gap-1.5 text-copy font-bold text-foreground">
          Alt text
          <input
            value={alt}
            maxLength={200}
            onChange={(e) => setAlt(e.target.value)}
            className="h-11 rounded-lg border border-border px-3 font-normal outline-none focus-visible:border-primary"
          />
        </label>
        <div className="text-copy">
          <p className="font-bold text-foreground">Used by</p>
          {item.usedBy?.length ? (
            <ul className="mt-1 flex flex-col gap-1">
              {item.usedBy.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="text-primary hover:underline">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">No product yet. Add it from a product’s “Browse”.</p>
          )}
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" className="text-copy text-primary hover:underline">
          Open original
        </a>
      </div>
    </AdaptiveSheet>
  );
}
