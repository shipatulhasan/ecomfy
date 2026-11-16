import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/products/form/product-form";
import { ProductFormSkeleton } from "@/components/admin/products/form/product-form-page";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getMaxUploadMb, getProductFilterOptions, nextProductSku } from "@/lib/queries/admin/products";
import type { ProductFormValues } from "@/lib/validations/admin-product";

export const metadata: Metadata = { title: "Add Product" };

/** Add Product (designs/screens/admin/Add Products.png), blank form. */
export default function NewProductPage() {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const user = await requireStaff("/admin/products/new");
  if (!can(user, "products:write")) return <Forbidden />;
  const [options, sku, maxMb] = await Promise.all([getProductFilterOptions(), nextProductSku(), getMaxUploadMb()]);

  const initial: ProductFormValues = {
    status: "DRAFT",
    name: "",
    slug: "",
    sku,
    shortDescription: "",
    description: "",
    categoryId: "",
    tags: [],
    brand: "",
    productType: "",
    taxIncluded: true,
    saleStartsAt: null,
    saleEndsAt: null,
    trackInventory: true,
    stockStatus: "IN_STOCK",
    lowStockThreshold: 5,
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
    options: [],
    variants: [{ key: "", name: "Standard", sku, price: 0, discount: null, stock: 0, size: null, color: null, weightGrams: null }],
    attributes: [],
    images: [],
  };

  return (
    <Container variant="admin" className="py-5">
      <ProductForm
        initial={initial}
        initialMedia={{}}
        categories={options.categories}
        brands={options.brands}
        tags={options.tags}
        maxMb={maxMb}
        canWrite
        canAddCategory={can(user, "categories:write")}
      />
    </Container>
  );
}
