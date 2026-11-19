import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CategoryManager } from "@/components/admin/categories/category-manager";
import { DiscoverTiles, DiscoverTilesSkeleton } from "@/components/admin/categories/discover-tiles";
import { CategoryHeaderActions } from "@/components/admin/categories/header-actions";
import { CategoryListSkeleton, CategoryPageSkeleton } from "@/components/admin/categories/skeletons";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { categoryParamsHref, parseCategoryParams, type CategoryListParams } from "@/lib/admin/categories/params";
import { can, canAny } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getAdminCategoryPage, getCategoryForEdit, getDiscoverTiles, getParentOptions } from "@/lib/queries/admin/categories";
import { getMaxUploadMb } from "@/lib/queries/admin/products";

export const metadata: Metadata = { title: "Categories" };

/**
 * Categories (designs/screens/admin/Categories.png): "Discover" header with
 * Create New Category / More Action, the top-level category tiles, then the
 * table card. List state lives in the URL (?q=&status=&parent=&page=&tiles=) and
 * runs on the server; the modal rides on it too (?modal=new, ?edit=<id>).
 * Deliberate changes from the PNG are listed in designs/DESIGN.md.
 */
export default function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  return (
    <Suspense fallback={<CategoryPageSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/categories">, "searchParams">) {
  const user = await requireStaff("/admin/categories");
  if (!can(user, "categories:read")) return <Forbidden />;
  const sp = await searchParams;
  const params = parseCategoryParams(sp);
  const edit = typeof sp.edit === "string" ? sp.edit : null;
  // Each server action re-checks its own create/update/delete permission.
  const canWrite = canAny(user, ["categories:create", "categories:update", "categories:delete"]);

  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">Discover</h2>
        <CategoryHeaderActions canWrite={canWrite} />
      </div>

      <Suspense fallback={<DiscoverTilesSkeleton />}>
        <Tiles params={params} />
      </Suspense>

      <section aria-label="Categories" className="rounded-xl bg-card p-4 tablet:p-6">
        <Suspense key={categoryParamsHref(params)} fallback={<CategoryListSkeleton />}>
          <List params={params} edit={edit} canWrite={canWrite} />
        </Suspense>
      </section>
    </Container>
  );
}

async function Tiles({ params }: { params: CategoryListParams }) {
  return <DiscoverTiles tiles={await getDiscoverTiles()} params={params} />;
}

async function List({ params, edit, canWrite }: { params: CategoryListParams; edit: string | null; canWrite: boolean }) {
  const [page, parents, editing, maxMb] = await Promise.all([
    getAdminCategoryPage(params),
    getParentOptions(),
    edit ? getCategoryForEdit(edit) : null,
    getMaxUploadMb(),
  ]);
  // Past the last page (e.g. after deletes): go to the last real one.
  if (params.page > page.pages) redirect(categoryParamsHref(params, { page: page.pages }));
  return <CategoryManager params={params} page={page} parents={parents} editing={editing} canWrite={canWrite} maxMb={maxMb} />;
}
