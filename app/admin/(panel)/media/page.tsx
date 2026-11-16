import type { Metadata } from "next";
import { Suspense } from "react";
import { MediaLibrary } from "@/components/admin/media/library";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getMaxUploadMb, listMedia, parseMediaParams } from "@/lib/queries/admin/products";

export const metadata: Metadata = { title: "Product Media" };

/**
 * Product Media (designs/screens/admin/Product Media.png): the media library.
 * Tiles with ✕ and the dashed "Add Image" tile, as in the PNG; search, the
 * used/unused filter, multi-select and bulk delete are additions. Images in use
 * by a product can't be deleted here.
 */
export default function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  return (
    <Suspense fallback={<MediaSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/media">, "searchParams">) {
  const user = await requireStaff("/admin/media");
  if (!can(user, "products:write")) return <Forbidden />;
  const params = parseMediaParams(await searchParams);
  const [page, maxMb] = await Promise.all([listMedia(params), getMaxUploadMb()]);
  return (
    <Container variant="admin" className="py-5">
      <MediaLibrary params={params} items={page.items} total={page.total} pages={page.pages} maxMb={maxMb} />
    </Container>
  );
}

function MediaSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <div className="grid grid-cols-2 gap-4 tablet:grid-cols-3 laptop:grid-cols-4 desktop:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-213/215 rounded-xl" />
        ))}
      </div>
    </Container>
  );
}
