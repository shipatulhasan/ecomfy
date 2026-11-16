import "server-only";
import { prisma } from "@/lib/db";
import { adminCategorySelect, toAdminCategoryRow } from "@/lib/admin/categories/rows";
import {
  CATEGORY_FAMILIES_PER_PAGE,
  CATEGORY_STATUS_TABS,
  type AdminCategoryFamily,
  type AdminCategoryPage,
  type AdminCategoryRow,
  type CategoryListParams,
  type CategoryStatusTab,
  type ParentOption,
} from "@/lib/admin/categories/params";
import { requirePermission } from "@/lib/auth-guards";

/**
 * Admin → Categories reads. Every call re-checks `categories:read`.
 *
 * Categories are a small table (one level of nesting), so the list loads the
 * whole tree in one indexed query and filters / pages families on the server:
 * a family (top-level category + its subcategories) never splits across pages,
 * and a search hit on a subcategory still shows it under its parent.
 */

async function loadAll(): Promise<AdminCategoryRow[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: adminCategorySelect,
  });
  return rows.map(toAdminCategoryRow);
}

const STATUS_TEST: Record<CategoryStatusTab, (r: AdminCategoryRow) => boolean> = {
  all: () => true,
  featured: (r) => r.isFeatured,
  active: (r) => r.isActive,
  inactive: (r) => !r.isActive,
};

/** `all`: every matching family on one page (CSV export). */
export async function getAdminCategoryPage(p: CategoryListParams, opts: { all?: boolean } = {}): Promise<AdminCategoryPage> {
  await requirePermission("categories:read");
  const all = await loadAll();

  const q = p.q.toLowerCase();
  const textHit = (r: AdminCategoryRow) => !q || r.name.toLowerCase().includes(q) || r.slug.includes(q);
  const tops = all.filter((r) => r.parentId === null && (!p.parent || r.id === p.parent));
  const kidsOf = (id: string) => all.filter((r) => r.parentId === id);

  // Tab counts: every row in scope (Discover tile + search), whatever the tab.
  const scoped = tops.flatMap((t) => [t, ...kidsOf(t.id)]).filter(textHit);
  const counts = Object.fromEntries(CATEGORY_STATUS_TABS.map((s) => [s, scoped.filter(STATUS_TEST[s]).length])) as Record<CategoryStatusTab, number>;

  const test = (r: AdminCategoryRow) => textHit(r) && STATUS_TEST[p.status](r);
  const filtered = Boolean(q) || p.status !== "all";
  const families: AdminCategoryFamily[] = tops.flatMap((t) => {
    const kids = kidsOf(t.id);
    const matches = test(t);
    const shown = filtered ? kids.filter(test) : kids;
    return matches || shown.length > 0 ? [{ ...t, matches, children: shown }] : [];
  });

  if (opts.all) return { families, page: 1, pages: 1, total: families.length, counts };
  const pages = Math.max(1, Math.ceil(families.length / CATEGORY_FAMILIES_PER_PAGE));
  const page = Math.min(p.page, pages);
  return {
    families: families.slice((page - 1) * CATEGORY_FAMILIES_PER_PAGE, page * CATEGORY_FAMILIES_PER_PAGE),
    page,
    pages,
    total: families.length,
    counts,
  };
}

/** Discover tiles: every top-level category, in order (inactive ones dimmed). */
export async function getDiscoverTiles(): Promise<AdminCategoryRow[]> {
  await requirePermission("categories:read");
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: adminCategorySelect,
  });
  return rows.map(toAdminCategoryRow);
}

/** The modal's "Parent category" options: top-level categories. */
export async function getParentOptions(): Promise<ParentOption[]> {
  await requirePermission("categories:read");
  const rows = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, _count: { select: { children: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, childCount: r._count.children }));
}

/** ?edit=<id>: the category the modal opens with on a fresh load. */
export async function getCategoryForEdit(id: string): Promise<AdminCategoryRow | null> {
  await requirePermission("categories:read");
  const row = await prisma.category.findUnique({ where: { id }, select: adminCategorySelect });
  return row ? toAdminCategoryRow(row) : null;
}
