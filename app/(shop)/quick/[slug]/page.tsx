import { redirect } from "next/navigation";
import { Suspense } from "react";

/**
 * /quick/[slug] opened directly (shared link, reload): there's no page behind it to
 * float over, so send the visitor to the full product page. Soft navigations from a
 * product card are intercepted by app/(shop)/@modal/(.)quick/[slug] instead.
 */
export default function QuickViewDirect({ params }: PageProps<"/quick/[slug]">) {
  return (
    <Suspense fallback={null}>
      <RedirectToProduct params={params} />
    </Suspense>
  );
}

async function RedirectToProduct({ params }: Pick<PageProps<"/quick/[slug]">, "params">): Promise<never> {
  const { slug } = await params;
  redirect(`/product/${encodeURIComponent(slug)}`);
}
