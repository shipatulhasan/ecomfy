"use client";

import { LogOutIcon, SettingsIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminSignOutAction } from "@/lib/actions/admin-auth";

/** Topbar avatar (40 circle) → profile, store, log out. */
export function UserMenu({ name, email, roleLabel, image }: { name: string; email: string; roleLabel: string; image: string | null }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="tap-target grid place-items-center rounded-full">
        <Avatar className="size-10">
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback className="bg-warning text-copy font-bold text-foreground">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-copy font-bold text-foreground">{name}</span>
          <span className="truncate text-caption font-normal text-muted-foreground">{email}</span>
          <span className="mt-1 w-fit rounded-full bg-secondary px-2 py-0.5 text-caption text-secondary-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/settings">
            <SettingsIcon aria-hidden /> General Info
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/" target="_blank" rel="noopener">
            <StoreIcon aria-hidden /> Your Store
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void adminSignOutAction()}>
          <LogOutIcon aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
