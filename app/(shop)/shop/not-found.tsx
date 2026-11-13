import Link from "next/link";
import { Container } from "@/components/shared/container";
import { shopContent } from "@/lib/config/shop";

/** Unknown ?category= (notFound() from the Shop page). */
export default function ShopNotFound() {
  const t = shopContent.notFound;
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-h1">{t.title}</h1>
      <p className="text-lead text-muted-foreground">{t.description}</p>
      <Link
        href="/shop"
        className="press mt-2 inline-flex h-11 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground transition-colors hover:bg-brand-dark"
      >
        {t.cta}
      </Link>
    </Container>
  );
}
