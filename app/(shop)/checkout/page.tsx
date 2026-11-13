import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import type { AddressState } from "@/components/shop/checkout/address-fields";
import { CheckoutForm } from "@/components/shop/checkout/checkout-form";
import { CheckoutSkeleton } from "@/components/shop/checkout/checkout-skeleton";
import { PageHero, type Crumb } from "@/components/shop/page-hero";
import { getCurrentUser } from "@/lib/auth-guards";
import { computeCheckoutQuote } from "@/lib/checkout/pricing";
import { checkoutCopy } from "@/lib/config/checkout";
import { isDistrict } from "@/lib/config/districts";
import { prisma } from "@/lib/db";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { getCart } from "@/lib/queries/cart";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Checkout (designs/screens/web/Checkout.png): bKash, SSLCommerz (cards / online
 * banking) and Cash on Delivery. Per-visitor and request-time (cart, session),
 * so the form streams in behind a skeleton; never indexed.
 */
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

const crumbs: Crumb[] = [
  { label: "Home", href: "/" },
  { label: checkoutCopy.crumbCart, href: "/cart" },
  { label: checkoutCopy.crumb },
];

export default function CheckoutPage() {
  return (
    <PageTransition>
      <PageHero crumbs={crumbs} />
      <Container className="pt-6 pb-section tablet:pt-8 laptop:pt-8 laptop:pb-20">
        <h1 className="sr-only">{checkoutCopy.title}</h1>
        <Suspense fallback={<CheckoutSkeleton />}>
          <CheckoutSection />
        </Suspense>
      </Container>
    </PageTransition>
  );
}

async function CheckoutSection() {
  const [cart, settings, user] = await Promise.all([getCart(), getStoreSettings(), getCurrentUser()]);
  if (cart.lines.length === 0) redirect("/cart");
  if (cart.hasIssues) redirect("/cart?notice=stock");

  let address: AddressState | null = null;
  if (user) {
    const saved = await prisma.address.findFirst({
      where: { userId: user.id, kind: "BILLING" },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    const [firstName = "", ...rest] = user.name.split(" ");
    address = saved
      ? {
          firstName: saved.firstName,
          lastName: saved.lastName,
          companyName: saved.companyName ?? "",
          street: saved.street,
          city: saved.city,
          district: isDistrict(saved.district) ? saved.district : "",
          zip: saved.zip,
          email: saved.email,
          phone: saved.phone,
        }
      : {
          firstName,
          lastName: rest.join(" "),
          companyName: "",
          street: "",
          city: "",
          district: "",
          zip: "",
          email: user.email,
          phone: (await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? "",
        };
  }

  const district = address?.district || null;
  // The design preselects Cash on Delivery; fall back when it isn't allowed.
  const probe = computeCheckoutQuote(cart, settings, district, "COD");
  const method: PaymentMethod =
    (["COD", "BKASH", "SSLCOMMERZ"] as const).find((m) => probe.methods[m].enabled) ?? "COD";
  const quote = method === "COD" ? probe : computeCheckoutQuote(cart, settings, district, method);

  return (
    <CheckoutForm
      cart={cart}
      initialQuote={quote}
      initialAddress={address}
      signedIn={!!user}
      codFeeCents={settings.codFeeCents}
    />
  );
}
