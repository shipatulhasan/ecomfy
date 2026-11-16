"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCategory, deleteCategory, reorderCategories, toggleCategory, updateCategory } from "@/lib/actions/admin-categories";
import type { ActionResult } from "@/lib/actions/result";
import {
  canReorderView,
  CATEGORY_FAMILIES_PER_PAGE,
  categoryParamsHref,
  type AdminCategoryFamily,
  type AdminCategoryPage,
  type AdminCategoryRow,
  type CategoryListParams,
  type ParentOption,
} from "@/lib/admin/categories/params";
import type { CategoryFormData } from "@/lib/validations/admin-category";
import { ListPagination } from "@/components/admin/products/list/pagination";
import { Button } from "@/components/ui/button";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { CategoryDialog } from "./category-dialog";
import { CategoryRowView, type RowHandlers } from "./category-row";
import { CategoryEmptyState, CategoryToolbar } from "./toolbar";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { useCategoryModal } from "./use-category-modal";

type Op =
  | { type: "upsert"; row: AdminCategoryRow }
  | { type: "remove"; id: string }
  | { type: "patch"; ids: string[]; patch: Partial<AdminCategoryRow> }
  | { type: "reorder"; parentId: string | null; ids: string[] };

/** Optimistic list updates: the row changes at once, the server refresh confirms it. */
function reduce(families: AdminCategoryFamily[], op: Op): AdminCategoryFamily[] {
  switch (op.type) {
    case "patch": {
      const ids = new Set(op.ids);
      const p = (r: AdminCategoryRow) => (ids.has(r.id) ? { ...r, ...op.patch } : r);
      return families.map((f) => ({ ...p(f), matches: f.matches, children: f.children.map(p) }));
    }
    case "remove":
      return families.filter((f) => f.id !== op.id).map((f) => ({ ...f, children: f.children.filter((c) => c.id !== op.id) }));
    case "reorder": {
      const order = (rows: AdminCategoryRow[]) => op.ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
      if (op.parentId === null) return order(families) as AdminCategoryFamily[];
      return families.map((f) => (f.id === op.parentId ? { ...f, children: order(f.children) } : f));
    }
    case "upsert": {
      const { row } = op;
      const existing = families.find((f) => f.id === row.id);
      if (row.parentId === null) {
        if (existing) return families.map((f) => (f.id === row.id ? { ...f, ...row } : f));
        const rest = reduce(families, { type: "remove", id: row.id });
        return [...rest, { ...row, children: [], matches: true }];
      }
      const rest = reduce(families, { type: "remove", id: row.id });
      return rest.map((f) => {
        if (f.id !== row.parentId) return f;
        const at = f.children.findIndex((c) => c.id === row.id);
        const children = at >= 0 ? f.children.map((c) => (c.id === row.id ? row : c)) : [...f.children, row];
        return { ...f, children, childCount: at >= 0 ? f.childCount : f.childCount + 1 };
      });
    }
  }
}

/**
 * Categories.png table card (laptop+) and cards (below laptop): toolbar with the
 * status tabs, search, filter sheet, ⊕ and ⋯; rows grouped by family
 * (subcategories indented under their parent); drag handles reorder siblings;
 * edit / delete / ⋯ per row; the Create / Edit modal; the delete dialog.
 * Every mutation is applied optimistically, then confirmed by the server refresh.
 */
export function CategoryManager({
  params,
  page,
  parents,
  editing,
  canWrite,
  maxMb,
}: {
  params: CategoryListParams;
  page: AdminCategoryPage;
  parents: ParentOption[];
  /** ?edit=<id> on a fresh load: the row, whatever page it's on. */
  editing: AdminCategoryRow | null;
  canWrite: boolean;
  maxMb: number;
}) {
  const router = useRouter();
  const modal = useCategoryModal();
  const [families, apply] = useOptimistic(page.families, reduce);
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const rows = useMemo(() => families.flatMap((f) => [f, ...f.children]), [families]);
  const live = useMemo(() => new Set([...selected].filter((id) => rows.some((r) => r.id === id))), [selected, rows]);

  /** Run a mutation inside a transition: optimistic op first, server action, toast, refresh. */
  const mutate = useCallback(
    <T,>(op: Op | null, action: () => Promise<ActionResult<T>>, done: (data: T) => string | null) =>
      new Promise<ActionResult<T>>((resolve) =>
        startTransition(async () => {
          if (op) apply(op);
          const res = await action();
          if (res.ok) {
            const msg = done(res.data);
            if (msg) toast.success(msg);
            router.refresh();
          } else if (!res.fieldErrors) {
            toast.error(res.error);
          }
          resolve(res);
        }),
      ),
    [apply, router],
  );

  const findRow = useCallback(
    (id: string) => rows.find((r) => r.id === id) ?? (editing?.id === id ? editing : null),
    [rows, editing],
  );

  const save = (data: CategoryFormData) => {
    const before = data.id ? findRow(data.id) : null;
    const optimistic: AdminCategoryRow = {
      ...(before ?? {
        id: `pending-${data.slug}`,
        productCount: 0,
        childCount: 0,
        sortOrder: Number.MAX_SAFE_INTEGER,
        createdAt: new Date().toISOString(),
        imageUrl: null,
        blurDataURL: null,
      }),
      name: data.name,
      slug: data.slug,
      parentId: data.parentId,
      description: data.description,
      imageId: data.imageId,
      imageAlt: data.imageAlt,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      ...(before && before.imageId !== data.imageId && { imageUrl: null, blurDataURL: null }),
    } as AdminCategoryRow;
    return mutate(
      { type: "upsert", row: optimistic },
      () => (data.id ? updateCategory(data) : createCategory(data)),
      (row) => {
        modal.close();
        return before ? `Saved “${row.name}”` : `Created “${row.name}”`;
      },
    );
  };

  const handlers: RowHandlers = {
    edit: (row) => modal.open({ kind: "edit", id: row.id }),
    remove: (row) => setDeleting({ id: row.id, name: row.name }),
    toggle: (row, field, value) =>
      void mutate({ type: "patch", ids: [row.id], patch: { [field]: value } }, () => toggleCategory({ ids: [row.id], field, value }), () =>
        field === "isActive" ? `“${row.name}” ${value ? "is active" : "is hidden from the store"}` : `“${row.name}” ${value ? "is on" : "removed from"} the home page`,
      ),
    select: (id, on) =>
      setSelected((s) => {
        const next = new Set(s);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
  };

  const confirmDelete = async (moveProductsTo: string | undefined) => {
    if (!deleting) return false;
    const { id, name } = deleting;
    const res = await mutate({ type: "remove", id }, () => deleteCategory({ id, moveProductsTo }), (d) =>
      d.moved ? `Moved ${d.moved} product${d.moved === 1 ? "" : "s"} and deleted “${name}”` : `Deleted “${name}”`,
    );
    if (res.ok && (modal.state?.kind === "edit" && modal.state.id === id)) modal.close();
    return res.ok;
  };
  const closeDelete = useCallback((open: boolean) => !open && setDeleting(null), []);

  // ── drag to reorder (siblings only) ──
  const reorderable = canWrite && canReorderView(params);
  const reorder = (parentId: string | null, list: AdminCategoryRow[], { active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = list.findIndex((r) => r.id === active.id);
    const to = list.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const ids = arrayMove(list, from, to).map((r) => r.id);
    void mutate({ type: "reorder", parentId, ids }, () => reorderCategories({ parentId, ids }), () => "Order saved");
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dndId = useId();

  const offset = (page.page - 1) * CATEGORY_FAMILIES_PER_PAGE;
  const allIds = rows.map((r) => r.id);

  return (
    <>
      <CategoryToolbar
        params={params}
        counts={page.counts}
        parents={parents}
        canWrite={canWrite}
        onCreate={() => modal.open({ kind: "new" })}
        onSelectAll={() => setSelected(new Set(allIds))}
      />

      {families.length === 0 ? (
        <CategoryEmptyState params={params} canWrite={canWrite} onCreate={() => modal.open({ kind: "new" })} />
      ) : (
        <div className="mt-6">
          <p aria-live="polite" className="sr-only">
            {page.total} categor{page.total === 1 ? "y" : "ies"}, page {page.page} of {page.pages}
          </p>
          {!reorderable && canWrite && <p className="sr-only">Clear the search and pick the All tab to reorder categories.</p>}

          <div role="table" aria-label="Categories" aria-rowcount={rows.length + 1}>
            {/* Header (laptop+): mint band as in the PNG. */}
            <div role="rowgroup" className="hidden laptop:block">
              <div role="row" className="grid h-14 grid-cols-(--cat-cols) items-center rounded-lg bg-secondary px-6 text-lead font-medium text-foreground [--cat-cols:10fr_27fr_25fr_23fr_15fr]">
                <span role="columnheader">No.</span>
                <span role="columnheader">Category</span>
                <span role="columnheader">Created Date</span>
                <span role="columnheader">Products</span>
                <span role="columnheader">Action</span>
              </div>
            </div>

            <DndContext id={`${dndId}-top`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => reorder(null, families, e)}>
              <SortableContext items={families.map((f) => f.id)} strategy={verticalListSortingStrategy} disabled={!reorderable}>
                <div role="rowgroup" className="flex flex-col gap-3 laptop:gap-0">
                  {families.map((f, i) => (
                    <SortableFamily key={f.id} id={f.id} label={f.name} disabled={!reorderable || f.id.startsWith("pending-")} canWrite={canWrite}>
                      {(handle) => (
                        <>
                          <CategoryRowView
                            row={f}
                            number={`${offset + i + 1}`}
                            dimmed={!f.matches}
                            handle={handle}
                            canWrite={canWrite}
                            selected={live.has(f.id)}
                            handlers={handlers}
                          />
                          {f.children.length > 0 && (
                            <DndContext
                              id={`${dndId}-${f.id}`}
                              sensors={sensors}
                              collisionDetection={closestCenter}
                             
                              onDragEnd={(e) => reorder(f.id, f.children, e)}
                            >
                              <SortableContext items={f.children.map((c) => c.id)} strategy={verticalListSortingStrategy} disabled={!reorderable}>
                                {f.children.map((c, j) => (
                                  <SortableFamily key={c.id} id={c.id} label={c.name} disabled={!reorderable || c.id.startsWith("pending-")} canWrite={canWrite}>
                                    {(childHandle) => (
                                      <CategoryRowView
                                        row={c}
                                        parentName={f.name}
                                        number={`${offset + i + 1}.${j + 1}`}
                                        handle={childHandle}
                                        canWrite={canWrite}
                                        selected={live.has(c.id)}
                                        handlers={handlers}
                                      />
                                    )}
                                  </SortableFamily>
                                ))}
                              </SortableContext>
                            </DndContext>
                          )}
                        </>
                      )}
                    </SortableFamily>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {canWrite && live.size > 0 && (
            <BulkBar
              count={live.size}
              onClear={() => setSelected(new Set())}
              onToggle={(field, value) => {
                const ids = [...live];
                void mutate({ type: "patch", ids, patch: { [field]: value } }, () => toggleCategory({ ids, field, value }), (d) => {
                  setSelected(new Set());
                  return `Updated ${d.updated} categor${d.updated === 1 ? "y" : "ies"}`;
                });
              }}
            />
          )}

          <ListPagination page={page.page} pages={page.pages} href={(n) => categoryParamsHref(params, { page: n })} />
        </div>
      )}

      <CategoryDialog
        state={modal.state}
        findRow={findRow}
        parents={parents}
        canWrite={canWrite}
        maxMb={maxMb}
        onClose={modal.close}
        onSave={save}
        onDelete={(row) => setDeleting({ id: row.id, name: row.name })}
      />
      <DeleteCategoryDialog target={deleting} onOpenChange={closeDelete} onConfirm={confirmDelete} />
    </>
  );
}

/** A sortable family / subcategory row. It renders the drag handle and hands it to the row. */
function SortableFamily({
  id,
  label,
  disabled,
  canWrite,
  children,
}: {
  id: string;
  label: string;
  disabled: boolean;
  canWrite: boolean;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = canWrite ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={`Reorder ${label}`}
      title={disabled ? "Clear the search and pick “All” to reorder" : "Drag to reorder"}
      className="tap-target -ml-1 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <GripVerticalIcon aria-hidden className="size-4" />
    </button>
  ) : null;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10 rounded-lg bg-card shadow-lg" : undefined}
    >
      {children(handle)}
    </div>
  );
}

function BulkBar({ count, onClear, onToggle }: { count: number; onClear: () => void; onToggle: (field: "isActive" | "isFeatured", value: boolean) => void }) {
  return (
    <div role="region" aria-label="Bulk actions" className="sticky bottom-(--app-bottom-safe) z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
      <span className="mr-auto flex items-center gap-2 text-copy font-bold text-foreground">
        <button type="button" aria-label="Clear selection" onClick={onClear} className="tap-target grid size-8 place-items-center rounded-md hover:bg-muted">
          <XIcon aria-hidden className="size-4" />
        </button>
        {count} selected
      </span>
      <Button size="lg" className="h-10 px-4" onClick={() => onToggle("isActive", true)}>
        Activate
      </Button>
      <Button size="lg" variant="outline" className="h-10 px-4" onClick={() => onToggle("isActive", false)}>
        Deactivate
      </Button>
      <Button size="lg" variant="outline" className="h-10 px-4" onClick={() => onToggle("isFeatured", true)}>
        Feature on home
      </Button>
      <Button size="lg" variant="outline" className="h-10 px-4" onClick={() => onToggle("isFeatured", false)}>
        Remove from home
      </Button>
    </div>
  );
}
