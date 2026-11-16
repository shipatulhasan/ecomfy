"use client";

import { Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
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
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions/result";
import type { AdminCategoryRow, ParentOption } from "@/lib/admin/categories/params";
import type { CategoryFormData } from "@/lib/validations/admin-category";
import { CATEGORY_FORM_ID, CategoryForm } from "./category-form";
import type { CategoryModalState } from "./use-category-modal";

const modalKey = (s: CategoryModalState) => (s ? (s.kind === "new" ? "new" : s.id) : null);

/**
 * Create / Edit Category modal (no PNG; derived from Add Products + Product
 * List). Open state is the URL (useCategoryModal). Esc, the overlay, ✕ and
 * Cancel all ask before throwing away unsaved changes. Footer: Delete (edit,
 * left) · Cancel (ghost) · Save (primary), the Product List button styles.
 */
export function CategoryDialog({
  state,
  findRow,
  parents,
  canWrite,
  maxMb,
  onClose,
  onSave,
  onDelete,
}: {
  state: CategoryModalState;
  /** The row being edited (from the list, or the server on a fresh ?edit= load). */
  findRow: (id: string) => AdminCategoryRow | null;
  parents: ParentOption[];
  canWrite: boolean;
  maxMb: number;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<ActionResult<AdminCategoryRow>>;
  onDelete: (row: AdminCategoryRow) => void;
}) {
  // Keep rendering the last state while the close animation runs.
  const [shown, setShown] = useState(state);
  if (state && modalKey(state) !== modalKey(shown)) setShown(state);
  const view = state ?? shown;

  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);
  const onPendingChange = useCallback((p: boolean) => setPending(p), []);

  const row = view?.kind === "edit" ? findRow(view.id) : null;
  const missing = view?.kind === "edit" && !row;
  const isNew = view?.kind === "new";

  const requestClose = () => {
    if (pending) return;
    if (dirty) setConfirm(true);
    else onClose();
  };

  const title = isNew ? "Create New Category" : !canWrite ? "Category Details" : "Edit Category";
  const description = missing ? undefined : isNew ? "It shows on the store as soon as it’s active." : row?.parentId ? `Subcategory · /shop?category=${row.slug}` : undefined;

  return (
    <>
      <ResponsiveModal
        open={state !== null}
        onOpenChange={(o) => !o && requestClose()}
        title={title}
        description={description}
        className="laptop:max-w-152"
        footer={
          missing ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" className="h-10 px-4" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {row && canWrite && (
                <Button type="button" variant="ghost" className="h-10 px-3 text-sale hover:bg-sale-soft hover:text-sale" disabled={pending} onClick={() => onDelete(row)}>
                  <Trash2Icon aria-hidden /> Delete
                </Button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <Button type="button" variant="ghost" className="h-10 px-4 text-lead" disabled={pending} onClick={requestClose}>
                  {canWrite ? "Cancel" : "Close"}
                </Button>
                {canWrite && (
                  <Button type="submit" form={CATEGORY_FORM_ID} className="h-10 px-4 text-lead text-white" disabled={pending}>
                    {pending ? "Saving…" : isNew ? "Create Category" : "Save Changes"}
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {missing ? (
          <p className="text-copy text-muted-foreground">This category no longer exists. It may have been deleted.</p>
        ) : view ? (
          <CategoryForm
            key={modalKey(view)!}
            row={row}
            parents={parents}
            canWrite={canWrite}
            maxMb={maxMb}
            onSubmit={onSave}
            onDirtyChange={onDirtyChange}
            onPendingChange={onPendingChange}
          />
        ) : null}
      </ResponsiveModal>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes to this category. They’ll be lost if you close it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                setDirty(false);
                onClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
