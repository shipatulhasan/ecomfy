"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maxLineQuantity, type CartLine } from "@/lib/cart/pricing";
import { cartCopy } from "@/lib/config/cart";
import { laptopSizes } from "@/lib/image-sizes";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "../product/quantity-stepper";
import { isTempLine, useCart } from "./cart-provider";
import { CartLineImage } from "./cart-line-image";
import { RemoveButton } from "./remove-button";

/**
 * Cart items on /cart.
 *
 * - Laptop+ (<CartTable>): the PNG's 872-wide card (Figma 460:42625). Product /
 *   Price / Quantity / Subtotal / ✕ columns at the design offsets, 100-high rows
 *   with inset dividers, then "Return to shop" and "Update Cart".
 * - Below laptop (<CartLineCards>): one card per line, photo left, name, unit price,
 *   stepper and line total right, ✕ top-right.
 *
 * Quantity taps apply at once and save debounced (cart-provider). Lines with a
 * stock problem say so and are muted; checkout stays disabled until fixed.
 */

/** Column widths in design px ÷ 16 (row 832 = 383 + 114 + 186 + 125 + 24). */
const COLS = ["", "w-[7.125rem]", "w-[11.625rem]", "w-[7.8125rem]", "w-6"] as const;

// The header rule spans the whole card (872) while the row dividers are inset by
// the 20px card padding, so the header cells draw their own full-width rule.
const headRule =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border first:after:-left-5 last:after:-right-5";

export function CartTable({ lines }: { lines: CartLine[] }) {
  return (
    <div className="hidden rounded-lg border border-border bg-card laptop:block">
      <div className="px-5">
        <Table className="table-fixed">
          <colgroup>
            {COLS.map((c, i) => (
              <col key={i} className={c} />
            ))}
          </colgroup>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="hover:bg-transparent">
              {[cartCopy.product, cartCopy.price, cartCopy.quantity, cartCopy.subtotal].map((h) => (
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
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <CartTableRow key={line.variantId} line={line} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-4">
        <Link
          href="/shop"
          transitionTypes={["nav-back"]}
          className="press inline-flex h-11.25 items-center rounded-full bg-muted-strong px-8 text-copy font-semibold text-text-body hover:bg-border"
        >
          {cartCopy.returnToShop}
        </Link>
        <UpdateCartButton />
      </div>
    </div>
  );
}

function CartTableRow({ line }: { line: CartLine }) {
  const { setQuantity, remove } = useCart();
  const pending = isTempLine(line);
  return (
    <TableRow className={cn("hover:bg-transparent", line.issue && "bg-sale-soft/30")}>
      <TableCell className="px-0 py-3">
        <div className={cn("flex items-center gap-3", line.issue?.kind === "out" && "opacity-60")}>
          <CartLineImage image={line.image} sizes={laptopSizes(100)} className="size-25" />
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/product/${line.slug}`}
              transitionTypes={["nav-forward"]}
              className="truncate text-lead text-foreground hover:text-primary"
            >
              {line.name}
            </Link>
            <LineMeta line={line} />
          </div>
        </div>
      </TableCell>
      <TableCell className="px-0 py-3 text-lead text-foreground">{formatPrice(line.unitCents)}</TableCell>
      <TableCell className="px-0 py-3">
        <LineStepper line={line} onChange={(q) => setQuantity(line, q)} disabled={pending} />
      </TableCell>
      <TableCell className="px-0 py-3 text-lead font-medium text-foreground tabular-nums">
        {formatPrice(line.lineCents)}
      </TableCell>
      <TableCell className="px-0 py-3 text-right">
        <RemoveButton label={cartCopy.remove(line.name)} onClick={() => remove(line)} disabled={pending} />
      </TableCell>
    </TableRow>
  );
}

/** Variant + stock warning under the name. */
function LineMeta({ line }: { line: CartLine }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-copy text-muted-foreground">
      <span>{line.variantName}</span>
      {line.issue && (
        <span role="status" className="font-medium text-sale">
          {line.issue.kind === "out" ? cartCopy.outOfStock : cartCopy.onlyLeft(line.issue.available)}
        </span>
      )}
    </p>
  );
}

function LineStepper({
  line,
  onChange,
  disabled,
  compact,
}: {
  line: CartLine;
  onChange: (q: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const out = line.issue?.kind === "out";
  // Above-stock lines can still step down to fix themselves.
  const max = Math.max(maxLineQuantity(line.stock), 1);
  return (
    <QuantityStepper
      value={line.quantity}
      onChange={onChange}
      max={max}
      disabled={disabled || out}
      compact={compact}
      className={compact ? "h-11 laptop:h-12.5" : undefined}
    />
  );
}

function UpdateCartButton() {
  const { flush } = useCart();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await flush();
          toast.success(cartCopy.updated, { id: "cart-updated" });
        })
      }
      className="press inline-flex h-11.25 items-center rounded-full bg-muted-strong px-8 text-copy font-semibold text-text-body hover:bg-border disabled:opacity-60"
    >
      {cartCopy.updateCart}
    </button>
  );
}

const CARD_IMAGE_SIZES = "(width >= 48rem) 112px, 96px";

/** Below laptop: one card per line (2 columns on tablet). */
export function CartLineCards({ lines }: { lines: CartLine[] }) {
  const { setQuantity, remove } = useCart();
  return (
    <ul className="grid gap-3 tablet:grid-cols-2 tablet:gap-4 laptop:hidden">
      {lines.map((line) => {
        const pending = isTempLine(line);
        return (
          <li
            key={line.variantId}
            className={cn(
              "relative flex gap-3 rounded-lg border border-border bg-card p-3",
              line.issue && "border-sale/40",
            )}
          >
            <CartLineImage
              image={line.image}
              sizes={CARD_IMAGE_SIZES}
              className={cn("size-24 tablet:size-28", line.issue?.kind === "out" && "opacity-60")}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start gap-2 pr-8">
                <Link
                  href={`/product/${line.slug}`}
                  transitionTypes={["nav-forward"]}
                  className="line-clamp-2 text-copy font-medium text-foreground"
                >
                  {line.name}
                </Link>
              </div>
              <p className="text-caption text-muted-foreground">
                {formatPrice(line.unitCents)} / {line.variantName}
              </p>
              {line.issue && (
                <p role="status" className="text-caption font-medium text-sale">
                  {line.issue.kind === "out" ? cartCopy.outOfStock : cartCopy.onlyLeft(line.issue.available)}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <LineStepper line={line} onChange={(q) => setQuantity(line, q)} disabled={pending} compact />
                <span className="text-copy font-semibold text-foreground tabular-nums">{formatPrice(line.lineCents)}</span>
              </div>
            </div>
            <RemoveButton
              label={cartCopy.remove(line.name)}
              onClick={() => remove(line)}
              disabled={pending}
              className="absolute top-1 right-1 size-8 border-transparent"
            />
          </li>
        );
      })}
    </ul>
  );
}
