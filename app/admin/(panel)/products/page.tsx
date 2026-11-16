import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductListToolbar } from "@/components/admin/products/list/toolbar";
import { ProductListSkeleton, ProductRowsSkeleton } from "@/components/admin/products/list/skeletons";
import { ProductListView } from "@/components/admin/products/list/product-list-view";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { parseProductParams, productParamsHref, type ProductListParams } from "@/lib/admin/products/params";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getProductFilterOptions, listAdminProducts, type ProductFilterOptions } from "@/lib/queries/admin/products";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Product List" };

/**
 * Product List (designs/screens/admin/Product List.png). All list state lives in
 * the URL (?q=&category=&status=&stock=&brand=&sort=&page=&perPage=); filtering,
 * sorting and paging run on the server. The rows stream in behind a skeleton.
 * Laptop+: the PNG table. Below laptop: cards, filters in a bottom sheet.
 */
export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<ProductListSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  const user = await requireStaff("/admin/products");
  if (!can(user, "products:read")) return <Forbidden />;
  const params = parseProductParams(await searchParams);
  const options = await getProductFilterOptions();
  const canWrite = can(user, "products:write");

  return (
    <Container variant="admin" className="py-5">
      <section aria-label="Products" className="rounded-xl bg-card p-4 tablet:p-6">
        <ProductListToolbar params={params} options={options} canWrite={canWrite} />
        <Suspense key={productParamsHref(params)} fallback={<ProductRowsSkeleton />}>
          <Rows params={params} options={options} canWrite={canWrite} />
        </Suspense>
      </section>
    </Container>
  );
}

async function Rows({ params, options, canWrite }: { params: ProductListParams; options: ProductFilterOptions; canWrite: boolean }) {
  const page = await listAdminProducts(params);
  // Past the last page (e.g. after a bulk delete): go to the last real one.
  if (page.rows.length === 0 && page.total > 0 && params.page > page.pages) {
    redirect(productParamsHref(params, { page: page.pages }));
  }
  return <ProductListView params={params} page={page} categories={options.categories} canWrite={canWrite} />;
}
