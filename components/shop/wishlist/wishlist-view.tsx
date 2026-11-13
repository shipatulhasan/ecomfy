"use client";

import { HeartIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeFromWishlist, toggleWishlist } from "@/lib/actions/wishlist";
import { cartCopy, wishlistCopy } from "@/lib/config/cart";
import { laptopSizes } from "@/lib/image-sizes";
import type { WishlistRow } from "@/lib/queries/wishlist";
import { cn } from "@/lib/utils";
import { CartLineImage } from "../cart/cart-line-image";
import { RemoveButton } from "../cart/remove-button";
import { PriceTag } from "../price-tag";
import { ShareButtons } from "../product/share-buttons";
import { StockBadge } from "../product/stock-badge";
import { useShopState } from "../shop-state";
import { WishlistAddButton } from "./wishlist-add-button";

/**
 * /wishlist body (designs/screens/web/Wishlist.png).
 *
 * - Laptop+: the 1320 table card (Figma 460:42645): Product / Price / Stock Status,
 *   then "Add to Cart" and ✕; out-of-stock rows are muted with a disabled button;
 *   "Share:" row at the bottom.
 * - Below laptop: one card per product (1 column mobile, 2 tablet) with a
 *   full-width "Add to Cart".
 *
 * Rows come from the server (they re-render after every wishlist `refresh()`);
 * removing is optimistic here and in the header count, with "Undo".
 */
export function WishlistView({ rows, shareUrl }: { rows: WishlistRow[]; shareUrl: string }) {
  const { setWishlisted } = useShopState();
  const [shown, hide] = useOptimistic(rows, (current, productId: string) =>
    current.filter((r) => r.productId !== productId),
  );

  function remove(row: WishlistRow) {
    startTransition(async () => {
      hide(row.productId);
      setWishlisted(row.productId, false);
      const res = await removeFromWishlist({ productId: row.productId });
      if (!res.ok) {
        setWishlisted(row.productId, true);
        toast.error(res.error);
        return;
      }
      toast(wishlistCopy.removed(row.name), {
        id: `wish-removed-${row.productId}`,
        action: {
          label: cartCopy.undo,
          onClick: () =>
            startTransition(async () => {
              setWishlisted(row.productId, true);
              const undo = await toggleWishlist({ productId: row.productId });
              if (!undo.ok) {
                setWishlisted(row.productId, false);
                toast.error(undo.error);
              }
            }),
        },
      });
    });
  }

  if (shown.length === 0) return <EmptyWishlist />;

  return (
    <>
      <WishlistTable rows={shown} onRemove={remove} shareUrl={shareUrl} />
      <WishlistCards rows={shown} onRemove={remove} shareUrl={shareUrl} />
    </>
  );
}

type ListProps = { rows: WishlistRow[]; onRemove: (row: WishlistRow) => void; shareUrl: string };

/** Column widths in design px ÷ 16 (row 1272 = 535 + 336 + 209 + 192). */
const COLS = ["", "w-[21rem]", "w-[13.0625rem]", "w-[12rem]"] as const;

const headRule =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border first:after:-left-6 last:after:-right-6";

function WishlistTable({ rows, onRemove, shareUrl }: ListProps) {
  return (
    <div className="hidden rounded-lg border border-border bg-card laptop:block">
      <div className="px-6">
        <Table className="table-fixed">
          <colgroup>
            {COLS.map((c, i) => (
              <col key={i} className={c} />
            ))}
          </colgroup>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              {[wishlistCopy.product, wishlistCopy.price, wishlistCopy.stockStatus].map((h) => (
                <TableHead
                  key={h}
                  className={cn(
                    "h-auto px-0 py-4 text-copy leading-none font-medium tracking-wider text-text-body uppercase",
                    headRule,
                  )}
                >
                  {h}
                </TableHead>
              ))}
              <TableHead className={cn("h-auto px-0 py-4", headRule)}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const out = row.stock <= 0;
              return (
                <TableRow key={row.productId} className="hover:bg-transparent">
                  <TableCell className="px-0 py-3">
                    <div className={cn("flex items-center gap-3", out && "opacity-60")}>
                      <CartLineImage image={row.image} sizes={laptopSizes(100)} className="size-25" />
                      <Link
                        href={`/product/${row.slug}`}
                        transitionTypes={["nav-forward"]}
                        className="truncate text-lead text-foreground hover:text-primary"
                      >
                        {row.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className={cn("px-0 py-3", out && "opacity-60")}>
                    <PriceTag priceCents={row.priceCents} compareAtCents={row.compareAtCents} />
                  </TableCell>
                  <TableCell className="px-0 py-3">
                    <StockBadge stock={row.stock} />
                  </TableCell>
                  <TableCell className="px-0 py-3">
                    <div className="flex items-center justify-end gap-6">
                      <WishlistAddButton row={row} className="w-38" />
                      <RemoveButton
                        label={wishlistCopy.remove(row.name)}
                        onClick={() => onRemove(row)}
                        className="size-7"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-6 py-6">
        <ShareButtons url={shareUrl} title={wishlistCopy.pageTitle} label={wishlistCopy.share} />
      </div>
    </div>
  );
}

const CARD_IMAGE_SIZES = "(width >= 48rem) 112px, 96px";

function WishlistCards({ rows, onRemove, shareUrl }: ListProps) {
  return (
    <div className="flex flex-col gap-4 laptop:hidden">
      <ul className="grid gap-3 tablet:grid-cols-2 tablet:gap-4">
        {rows.map((row) => {
          const out = row.stock <= 0;
          return (
            <li key={row.productId} className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
              <div className={cn("flex gap-3", out && "opacity-60")}>
                <CartLineImage image={row.image} sizes={CARD_IMAGE_SIZES} className="size-24 tablet:size-28" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8">
                  <Link
                    href={`/product/${row.slug}`}
                    transitionTypes={["nav-forward"]}
                    className="line-clamp-2 text-copy font-medium text-foreground"
                  >
                    {row.name}
                  </Link>
                  <PriceTag priceCents={row.priceCents} compareAtCents={row.compareAtCents} />
                  <StockBadge stock={row.stock} className="self-start text-caption" />
                </div>
              </div>
              <WishlistAddButton row={row} className="w-full" />
              <RemoveButton
                label={wishlistCopy.remove(row.name)}
                onClick={() => onRemove(row)}
                className="absolute top-1 right-1 size-8 border-transparent"
              />
            </li>
          );
        })}
      </ul>
      <ShareButtons url={shareUrl} title={wishlistCopy.pageTitle} label={wishlistCopy.share} />
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
      <span className="grid size-18 place-items-center rounded-full bg-secondary text-primary">
        <HeartIcon aria-hidden className="size-8 stroke-[1.5]" />
      </span>
      <h2 className="text-h3 text-foreground">{wishlistCopy.emptyTitle}</h2>
      <p className="text-copy text-muted-foreground">{wishlistCopy.emptyBody}</p>
      <Link
        href="/shop"
        className="press mt-2 inline-flex h-12 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground hover:bg-brand-dark"
      >
        {wishlistCopy.browse}
      </Link>
    </div>
  );
}
