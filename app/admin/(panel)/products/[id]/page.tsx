import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/products/form/product-form";
import { ProductFormSkeleton } from "@/components/admin/products/form/product-form-page";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getAdminProduct, getMaxUploadMb, getProductFilterOptions } from "@/lib/queries/admin/products";

export const metadata: Metadata = { title: "Edit Product" };

/**
 * Edit Product: the Add Product form loaded with the product. Staff with
 * products:read but not products:update see it read-only (saving is refused
 * server-side as well).
 */
export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <Gate params={params} />
    </Suspense>
  );
}

async function Gate({ params }: Pick<PageProps<"/admin/products/[id]">, "params">) {
  const { id } = await params;
  const user = await requireStaff(`/admin/products/${encodeURIComponent(id)}`);
  if (!can(user, "products:read")) return <Forbidden />;
  const [product, options, maxMb] = await Promise.all([getAdminProduct(id), getProductFilterOptions(), getMaxUploadMb()]);
  if (!product) notFound();

  return (
    <Container variant="admin" className="py-5">
      <ProductForm
        key={`${product.values.id}:${product.updatedAt}`}
        initial={product.values}
        initialMedia={product.media}
        categories={options.categories}
        brands={options.brands}
        tags={options.tags}
        maxMb={maxMb}
        canWrite={can(user, "products:update")}
        canAddCategory={can(user, "categories:create")}
      />
    </Container>
  );
}
