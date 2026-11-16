"use client";

import {
  CornerDownRightIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  HomeIcon,
  ShapesIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { StatusChip } from "@/components/shared/status-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDhaka } from "@/lib/admin/date-range";
import type { AdminCategoryRow } from "@/lib/admin/categories/params";
import { cn } from "@/lib/utils";

export type RowHandlers = {
  edit: (row: AdminCategoryRow) => void;
  remove: (row: AdminCategoryRow) => void;
  toggle: (row: AdminCategoryRow, field: "isActive" | "isFeatured", value: boolean) => void;
  select: (id: string, on: boolean) => void;
};

const icon = "tap-target grid size-8 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground";

/**
 * One Categories.png row: No. (drag handle, checkbox, number) | Category
 * (thumbnail + name; subcategories indented with ↳) | Created Date | Products |
 * Action (edit, trash, ⋯). Below laptop the same row is a card: thumbnail, name,
 * counts and date, and "⋯" opening the actions in a bottom sheet.
 */
export function CategoryRowView({
  row,
  parentName,
  number,
  dimmed,
  handle,
  canWrite,
  selected,
  handlers,
}: {
  row: AdminCategoryRow;
  /** Set for subcategories. */
  parentName?: string;
  number: string;
  /** Shown only as the parent of a matching subcategory. */
  dimmed?: boolean;
  /** The drag handle (rendered by the sortable wrapper); null when read-only. */
  handle: React.ReactNode;
  canWrite: boolean;
  selected: boolean;
  handlers: RowHandlers;
}) {
  const child = Boolean(parentName);
  const pending = row.id.startsWith("pending-");
  const created = formatDhaka(row.createdAt, "MM-dd-yyyy");
  const products = `${row.productCount} product${row.productCount === 1 ? "" : "s"}`;

  return (
    <div
      role="row"
      aria-busy={pending || undefined}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-3 text-copy text-foreground transition-colors",
        "laptop:h-16 laptop:grid-cols-(--cat-cols) laptop:gap-0 laptop:rounded-none laptop:border-0 laptop:border-b laptop:px-6 laptop:py-0 laptop:text-lead [--cat-cols:10fr_27fr_25fr_23fr_15fr]",
        child && "mt-2 ms-6 laptop:mt-0 laptop:ms-0",
        selected && "border-primary bg-secondary/40",
        pending && "opacity-60",
      )}
    >
      {/* No. */}
      <div role="cell" className="flex items-center gap-2 laptop:gap-3">
        {handle}
        {canWrite && (
          <Checkbox
            aria-label={`Select ${row.name}`}
            checked={selected}
            disabled={pending}
            onCheckedChange={(v) => handlers.select(row.id, v === true)}
            className="size-5 rounded border-border"
          />
        )}
        <span className="hidden min-w-6 tabular-nums laptop:inline">{number}</span>
      </div>

      {/* Category */}
      <div role="cell" className={cn("flex min-w-0 items-center gap-3", child && "laptop:ps-4", dimmed && "opacity-60")}>
        {child && <CornerDownRightIcon aria-hidden className="hidden size-4 shrink-0 text-muted-foreground laptop:block" />}
        <Thumb row={row} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="line-clamp-2 laptop:leading-6" title={row.name}>
              {row.name}
            </span>
            {!row.isActive && <StatusChip tone="neutral">Inactive</StatusChip>}
            {row.isFeatured && (
              <StatusChip tone="success" className="inline-flex items-center gap-1">
                <HomeIcon aria-hidden className="size-3" /> Home
              </StatusChip>
            )}
          </span>
          <span className="text-caption text-muted-foreground laptop:hidden">
            {child ? `${parentName} › ` : ""}
            {products} · {created}
          </span>
        </div>
      </div>

      {/* Created Date (laptop+) */}
      <div role="cell" className="hidden laptop:block">
        {created}
      </div>

      {/* Products (laptop+): the PNG's "Order" column. */}
      <div role="cell" className="hidden tabular-nums laptop:block">
        {row.productCount}
        {row.childCount > 0 && <span className="text-caption text-muted-foreground"> · {row.childCount} sub</span>}
      </div>

      {/* Action */}
      <div role="cell" className="flex items-center justify-end gap-1 laptop:justify-start">
        <div className="hidden items-center gap-1 laptop:flex">
          <button type="button" aria-label={`${canWrite ? "Edit" : "View"} ${row.name}`} title={canWrite ? "Edit" : "View"} className={icon} disabled={pending} onClick={() => handlers.edit(row)}>
            <SquarePenIcon aria-hidden className="size-5 stroke-[1.5]" />
          </button>
          {canWrite && (
            <button type="button" aria-label={`Delete ${row.name}`} title="Delete" className={cn(icon, "hover:text-sale")} disabled={pending} onClick={() => handlers.remove(row)}>
              <Trash2Icon aria-hidden className="size-5 stroke-[1.5]" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`More actions for ${row.name}`} className={icon} disabled={pending}>
              <EllipsisIcon aria-hidden className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem asChild>
                <ViewOnStore row={row} />
              </DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handlers.toggle(row, "isActive", !row.isActive)}>
                    {row.isActive ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />} {row.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handlers.toggle(row, "isFeatured", !row.isFeatured)}>
                    <HomeIcon aria-hidden /> {row.isFeatured ? "Remove from home" : "Feature on home"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <RowActionsSheet row={row} canWrite={canWrite} disabled={pending} handlers={handlers} />
      </div>
    </div>
  );
}

function Thumb({ row }: { row: AdminCategoryRow }) {
  return (
    <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-card laptop:size-10">
      {row.imageUrl ? (
        <Image
          src={row.imageUrl}
          alt=""
          fill
          sizes="48px"
          placeholder={row.blurDataURL ? "blur" : "empty"}
          blurDataURL={row.blurDataURL ?? undefined}
          className="object-contain p-0.5"
        />
      ) : (
        <ShapesIcon aria-hidden className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}

function ViewOnStore({ row, className }: { row: AdminCategoryRow; className?: string }) {
  if (!row.isActive) {
    return (
      <span aria-disabled title="Activate it to show it on the store" className={cn(className, "cursor-not-allowed opacity-50")}>
        <EyeIcon aria-hidden className="size-5" /> Not on the store (inactive)
      </span>
    );
  }
  return (
    <a href={`/shop?category=${row.slug}`} target="_blank" rel="noreferrer" className={className}>
      <EyeIcon aria-hidden className="size-5" /> View on store
    </a>
  );
}

/** Below laptop: "⋯" opens the row's actions in a bottom sheet. */
function RowActionsSheet({ row, canWrite, disabled, handlers }: { row: AdminCategoryRow; canWrite: boolean; disabled: boolean; handlers: RowHandlers }) {
  const [open, setOpen] = useState(false);
  const item = "tap-target flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lead text-foreground hover:bg-muted disabled:opacity-50";
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <span className="laptop:hidden">
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={row.name}
        description={`/shop?category=${row.slug}`}
        closeOnLink
        trigger={
          <button type="button" aria-label={`Actions for ${row.name}`} className={icon} disabled={disabled}>
            <EllipsisIcon aria-hidden className="size-5" />
          </button>
        }
      >
        <ul className="flex flex-col py-1">
          <li>
            <button type="button" className={item} onClick={run(() => handlers.edit(row))}>
              <SquarePenIcon aria-hidden className="size-5" /> {canWrite ? "Edit" : "View details"}
            </button>
          </li>
          <li>
            <ViewOnStore row={row} className={item} />
          </li>
          {canWrite && (
            <>
              <li>
                <button type="button" className={item} onClick={run(() => handlers.toggle(row, "isActive", !row.isActive))}>
                  {row.isActive ? <EyeOffIcon aria-hidden className="size-5" /> : <EyeIcon aria-hidden className="size-5" />}
                  {row.isActive ? "Deactivate" : "Activate"}
                </button>
              </li>
              <li>
                <button type="button" className={item} onClick={run(() => handlers.toggle(row, "isFeatured", !row.isFeatured))}>
                  <HomeIcon aria-hidden className="size-5" /> {row.isFeatured ? "Remove from home" : "Feature on home"}
                </button>
              </li>
              <li>
                <button type="button" className={cn(item, "text-sale")} onClick={run(() => handlers.remove(row))}>
                  <Trash2Icon aria-hidden className="size-5" /> Delete
                </button>
              </li>
            </>
          )}
        </ul>
      </BottomSheet>
    </span>
  );
}
