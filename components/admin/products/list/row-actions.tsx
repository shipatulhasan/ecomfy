"use client";

import { ArchiveIcon, CopyIcon, EllipsisIcon, EyeIcon, FilePenLineIcon, SendIcon, SquarePenIcon, Trash2Icon, UndoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { bulkSetStatus, deleteProducts, duplicateProduct } from "@/lib/actions/admin-products";
import type { AdminProductRow } from "@/lib/queries/admin/products";
import { cn } from "@/lib/utils";
import { useProductAction } from "./use-product-action";

const icon = "tap-target grid size-8 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground";

/**
 * Product List.png row actions: eye (view on the store), edit, trash. The "⋯"
 * menu (not in the PNG) holds Duplicate and the status changes. Below laptop
 * the same actions open from "⋯" in a bottom sheet.
 */
export function RowActions({ row, canWrite }: { row: AdminProductRow; canWrite: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const actions = useRowActions(row);
  return (
    <div className="flex items-center gap-1">
      <ViewLink row={row} className={icon} />
      {canWrite && (
        <>
          <Link href={`/admin/products/${row.id}`} aria-label={`Edit ${row.name}`} title="Edit" className={icon}>
            <SquarePenIcon aria-hidden className="size-5 stroke-[1.5]" />
          </Link>
          <button type="button" aria-label={`Delete ${row.name}`} title="Delete" className={cn(icon, "hover:text-sale")} onClick={() => setConfirm(true)}>
            <Trash2Icon aria-hidden className="size-5 stroke-[1.5]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`More actions for ${row.name}`} className={icon} disabled={actions.pending}>
              <EllipsisIcon aria-hidden className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onSelect={actions.duplicate}>
                <CopyIcon aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.status !== "PUBLISHED" && (
                <DropdownMenuItem onSelect={() => actions.setStatus("PUBLISHED")}>
                  <SendIcon aria-hidden /> Publish
                </DropdownMenuItem>
              )}
              {row.status !== "DRAFT" && (
                <DropdownMenuItem onSelect={() => actions.setStatus("DRAFT")}>
                  {row.status === "ARCHIVED" ? <UndoIcon aria-hidden /> : <FilePenLineIcon aria-hidden />} Set to draft
                </DropdownMenuItem>
              )}
              {row.status !== "ARCHIVED" && (
                <DropdownMenuItem onSelect={() => actions.setStatus("ARCHIVED")}>
                  <ArchiveIcon aria-hidden /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DeleteDialog open={confirm} onOpenChange={setConfirm} names={[row.name]} onConfirm={actions.remove} />
        </>
      )}
    </div>
  );
}

/** Mobile card "⋯": the same actions as a list in a bottom sheet. */
export function RowActionsSheet({ row, canWrite }: { row: AdminProductRow; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const actions = useRowActions(row);
  const item = "tap-target flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lead text-foreground hover:bg-muted disabled:opacity-50";
  const close = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={row.name}
        description={`SKU ${row.sku}`}
        closeOnLink
        trigger={
          <button type="button" aria-label={`Actions for ${row.name}`} className={icon}>
            <EllipsisIcon aria-hidden className="size-5" />
          </button>
        }
      >
        <ul className="flex flex-col py-1">
          <li>
            <ViewLink row={row} className={item} label />
          </li>
          {canWrite && (
            <>
              <li>
                <Link href={`/admin/products/${row.id}`} className={item}>
                  <SquarePenIcon aria-hidden className="size-5" /> Edit
                </Link>
              </li>
              <li>
                <button type="button" className={item} disabled={actions.pending} onClick={close(actions.duplicate)}>
                  <CopyIcon aria-hidden className="size-5" /> Duplicate
                </button>
              </li>
              {row.status !== "PUBLISHED" && (
                <li>
                  <button type="button" className={item} disabled={actions.pending} onClick={close(() => actions.setStatus("PUBLISHED"))}>
                    <SendIcon aria-hidden className="size-5" /> Publish
                  </button>
                </li>
              )}
              {row.status !== "DRAFT" && (
                <li>
                  <button type="button" className={item} disabled={actions.pending} onClick={close(() => actions.setStatus("DRAFT"))}>
                    <FilePenLineIcon aria-hidden className="size-5" /> Set to draft
                  </button>
                </li>
              )}
              {row.status !== "ARCHIVED" && (
                <li>
                  <button type="button" className={item} disabled={actions.pending} onClick={close(() => actions.setStatus("ARCHIVED"))}>
                    <ArchiveIcon aria-hidden className="size-5" /> Archive
                  </button>
                </li>
              )}
              <li>
                <button type="button" className={cn(item, "text-sale")} onClick={close(() => setConfirm(true))}>
                  <Trash2Icon aria-hidden className="size-5" /> Delete
                </button>
              </li>
            </>
          )}
        </ul>
      </BottomSheet>
      {canWrite && <DeleteDialog open={confirm} onOpenChange={setConfirm} names={[row.name]} onConfirm={actions.remove} />}
    </>
  );
}

function ViewLink({ row, className, label }: { row: AdminProductRow; className: string; label?: boolean }) {
  const live = row.status === "PUBLISHED";
  const content = (
    <>
      <EyeIcon aria-hidden className="size-5 stroke-[1.5]" />
      {label && (live ? "View on store" : "Not on the store (unpublished)")}
    </>
  );
  if (!live) {
    return (
      <span aria-disabled title="Publish it to view it on the store" className={cn(className, "cursor-not-allowed opacity-40")}>
        {content}
        {!label && <span className="sr-only">Not on the store</span>}
      </span>
    );
  }
  return (
    <a href={`/product/${row.slug}`} target="_blank" rel="noreferrer" aria-label={label ? undefined : `View ${row.name} on the store`} title="View on store" className={className}>
      {content}
    </a>
  );
}

function useRowActions(row: AdminProductRow) {
  const router = useRouter();
  const { run, pending } = useProductAction();
  return {
    pending,
    duplicate: () =>
      void run(
        () => duplicateProduct({ id: row.id }),
        () => `Duplicated “${row.name}” as a draft`,
        (d) => router.push(`/admin/products/${d.id}`),
      ),
    setStatus: (status: AdminProductRow["status"]) =>
      void run(() => bulkSetStatus({ ids: [row.id], status }), () => STATUS_DONE[status](row.name)),
    remove: () => run(() => deleteProducts({ ids: [row.id] }), deletedMessage),
  };
}

const STATUS_DONE: Record<AdminProductRow["status"], (n: string) => string> = {
  PUBLISHED: (n) => `Published “${n}”`,
  DRAFT: (n) => `“${n}” set to draft`,
  ARCHIVED: (n) => `Archived “${n}”`,
};

export const deletedMessage = (d: { archived: number; deleted: number }) =>
  [d.deleted && `Deleted ${d.deleted}`, d.archived && `${d.archived} kept for past orders (hidden)`].filter(Boolean).join(" · ") || "Nothing to delete";

/** Confirm delete: products on past orders are hidden (soft delete), the rest removed for good. */
export function DeleteDialog({
  open,
  onOpenChange,
  names,
  onConfirm,
  kind = "product",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  names: string[];
  onConfirm: () => Promise<boolean>;
  kind?: "product" | "media";
}) {
  const [busy, setBusy] = useState(false);
  const many = names.length > 1;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{many ? `Delete ${names.length} ${kind === "media" ? "images" : "products"}?` : `Delete “${names[0]}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "media"
              ? "The file is removed from storage for good. Images used by a product can't be deleted."
              : `${many ? "They leave" : "It leaves"} the store and this list. Products that appear on past orders are kept hidden so those orders stay intact; the rest are deleted for good. This can’t be undone here.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await onConfirm();
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
