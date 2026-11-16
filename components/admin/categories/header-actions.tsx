"use client";

import { CirclePlusIcon, DownloadIcon, EllipsisVerticalIcon, ExternalLinkIcon, ImageIcon, PackageIcon } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCategoryModal } from "./use-category-modal";

/**
 * Categories.png header actions: green "⊕ Create New Category" (opens the modal
 * via ?modal=new) and the outlined "More Action ⋮" menu.
 */
export function CategoryHeaderActions({ canWrite }: { canWrite: boolean }) {
  const { open } = useCategoryModal();
  return (
    <div className="flex shrink-0 items-center gap-3">
      {canWrite && (
        <button
          type="button"
          onClick={() => open({ kind: "new" })}
          className="press inline-flex h-12 items-center gap-1 rounded-lg bg-primary px-3 text-lead font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <CirclePlusIcon aria-hidden className="size-6 stroke-[1.5]" />
          <span>
            Create <span className="hidden tablet:inline">New </span>Category
          </span>
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="press inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-3 text-lead font-medium text-foreground shadow-sm transition-colors hover:bg-muted">
          <span className="hidden tablet:inline">More Action</span>
          <span className="sr-only tablet:hidden">More actions</span>
          <EllipsisVerticalIcon aria-hidden className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem asChild>
            <a href="/shop" target="_blank" rel="noreferrer">
              <ExternalLinkIcon aria-hidden /> View categories on store
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/admin/categories/export" download>
              <DownloadIcon aria-hidden /> Export all categories (CSV)
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/products">
              <PackageIcon aria-hidden /> Product List
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/media">
              <ImageIcon aria-hidden /> Product Media
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
