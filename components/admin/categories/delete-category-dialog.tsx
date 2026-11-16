"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryDeleteInfo, type CategoryDeleteInfo } from "@/lib/actions/admin-categories";
import { cn } from "@/lib/utils";
import { dropdownClass } from "@/components/admin/products/form/pickers";

/**
 * Delete a category. Loads what blocks it first: subcategories block it outright
 * (move or delete them first); products must move to another category, picked
 * here, and move in the same transaction as the delete. No product is orphaned.
 */
export function DeleteCategoryDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  /** The category to delete; null = closed. */
  target: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  /** Runs the delete (optimistically); resolves true when it worked. */
  onConfirm: (moveProductsTo: string | undefined) => Promise<boolean>;
}) {
  const [info, setInfo] = useState<CategoryDeleteInfo | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // New target: reset during render (no effect needed), then load its counts.
  if ((target?.id ?? null) !== loadedFor) {
    setLoadedFor(target?.id ?? null);
    setInfo(null);
    setMoveTo("");
  }
  useEffect(() => {
    if (!target) return;
    let live = true;
    void getCategoryDeleteInfo({ id: target.id }).then((res) => {
      if (!live) return;
      if (res.ok) setInfo(res.data);
      else {
        toast.error(res.error);
        onOpenChange(false);
      }
    });
    return () => {
      live = false;
    };
  }, [target, onOpenChange]);

  const blockedByChildren = (info?.children.length ?? 0) > 0;
  const needsMove = (info?.products ?? 0) > 0;
  const canDelete = info && !blockedByChildren && (!needsMove || moveTo);

  return (
    <AlertDialog open={target !== null} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target?.name}”?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3 text-copy text-muted-foreground">
              {!info ? (
                <span role="status" aria-label="Checking what's in this category" className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </span>
              ) : blockedByChildren ? (
                <>
                  <span>
                    It has {info.children.length} subcategor{info.children.length === 1 ? "y" : "ies"}. Move them under another category or delete them first:
                  </span>
                  <span className="font-medium text-foreground">{info.children.map((c) => c.name).join(", ")}</span>
                </>
              ) : needsMove ? (
                <span>
                  It has <strong className="text-foreground">{info.products}</strong> product{info.products === 1 ? "" : "s"}. Move them to another category, then it’s deleted. Its store
                  URL stops working.
                </span>
              ) : (
                <span>It has no products or subcategories. It’s removed from the store for good; this can’t be undone.</span>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {info && !blockedByChildren && needsMove && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="move-products-to" className="text-copy font-bold text-foreground">
              Move {info.products} product{info.products === 1 ? "" : "s"} to…
            </label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-products-to" className={cn(dropdownClass, "data-[size=default]:h-11")}>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {info.targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{blockedByChildren ? "Close" : "Cancel"}</AlertDialogCancel>
          {!blockedByChildren && (
            <AlertDialogAction
              variant="destructive"
              disabled={!canDelete || busy}
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                const ok = await onConfirm(needsMove ? moveTo : undefined);
                setBusy(false);
                if (ok) onOpenChange(false);
              }}
            >
              {busy ? "Deleting…" : needsMove ? "Move & delete" : "Delete"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
