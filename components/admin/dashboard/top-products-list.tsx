"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductThumb } from "./product-thumb";

type Row = { id: string; name: string; code: string; imageUrl: string | null; price: string; units: number };

/** Filters the loaded top sellers as you type (client only, no round trip). */
export function TopProductsList({ products }: { products: Row[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = needle ? products.filter((p) => p.name.toLowerCase().includes(needle) || p.code.includes(needle)) : products;
  return (
    <>
      <label className="mt-3 flex h-9 items-center gap-2 rounded-md bg-muted px-2">
        <SearchIcon aria-hidden className="size-5 text-muted-foreground" />
        <span className="sr-only">Search top products</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="w-full min-w-0 bg-transparent text-copy text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <ul className="mt-5 max-h-83.75 flex-1 overflow-y-auto overscroll-contain pr-1">
        {rows.length === 0 && <li className="py-6 text-center text-copy text-muted-foreground">No products sold in this range.</li>}
        {rows.map((p) => (
          <li key={p.id} className="border-b border-border py-3 first:pt-0">
            <Link href={`/admin/products/${p.id}`} className="flex items-center gap-4 rounded-md hover:bg-muted/60">
              <ProductThumb src={p.imageUrl} size={56} className="size-14" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lead text-foreground">{p.name}</span>
                <span className="mt-1 block text-caption text-muted-foreground">
                  Item: #{p.code} · {p.units} sold
                </span>
              </span>
              <span className="shrink-0 text-lead font-bold text-foreground">{p.price}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
