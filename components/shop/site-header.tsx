import { ChevronDownIcon, MapPinIcon, MenuIcon, PhoneCallIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { phoneLabel } from "@/lib/checkout/settings";
import { siteConfig } from "@/lib/config/site";
import { getStoreSettings } from "@/lib/queries/settings";
import { CurrencySwitcher } from "@/components/shared/currency-switcher";
import { getCategoryTree } from "@/lib/queries/catalog";
import { CartDrawer } from "./cart/cart-drawer";
import { AuthLinks, HeaderBackButton, NavLinks, WishlistLink } from "./header-client";

/**
 * Storefront header (Figma "Navigation" 1920×191): green top bar, main bar
 * (logo, search, wishlist with count, cart → mini cart) and nav bar (All Categories, links, phone).
 *
 * - Laptop+: all three rows as in the PNG, scrolling with the page.
 * - Below laptop: a compact app bar with the logo, a search icon and the cart. It's
 *   sticky, translucent, clears the status bar (top safe area) and stays anchored
 *   during page transitions. Main navigation lives in the bottom tab bar
 *   (components/shop/mobile/bottom-nav.tsx), so there is no hamburger.
 *   `--app-header-h` (app/globals.css) mirrors its height for sticky toolbars below it.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md [view-transition-name:site-header] laptop:static laptop:bg-background laptop:pt-0 laptop:backdrop-blur-none">
      <TopBar />
      <MainBar />
      <NavBar />
    </header>
  );
}

async function TopBar() {
  const { store } = await getStoreSettings();
  return (
    <div className="hidden bg-primary text-caption text-primary-foreground laptop:block">
      <Container className="flex h-10.5 items-center justify-between gap-4">
        <p className="flex items-center gap-2">
          <MapPinIcon aria-hidden className="size-4" />
          Store Location: {store.address}
        </p>
        <div className="flex items-center gap-5">
          <Picker label="Language" options={siteConfig.languages} />
          <CurrencySwitcher />
          <span aria-hidden className="h-4 w-px bg-primary-foreground/30" />
          <AuthLinks />
        </div>
      </Container>
    </div>
  );
}

/** Language (display only until i18n exists). Currency: <CurrencySwitcher>. */
function Picker({ label, options }: { label: string; options: readonly string[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${options[0]}`}
        className="flex items-center gap-1 outline-none hover:underline focus-visible:underline"
      >
        {options[0]}
        <ChevronDownIcon aria-hidden className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-24">
        {options.map((o) => (
          <DropdownMenuItem key={o}>{o}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchForm({ className }: { className?: string }) {
  // Plain GET form: works without JS; the Shop page reads ?q=.
  return (
    <form action="/shop" role="search" className={className}>
      <label className="flex h-11 w-full overflow-hidden rounded-md border border-border focus-within:border-primary laptop:h-11.25">
        <span className="sr-only">Search products</span>
        <SearchIcon aria-hidden className="ml-4 size-5 shrink-0 self-center text-foreground" />
        <input
          type="search"
          name="q"
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent px-2 text-copy text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="bg-primary px-6 text-copy font-semibold text-primary-foreground transition-colors hover:bg-brand-dark"
        >
          Search
        </button>
      </label>
    </form>
  );
}

async function MainBar() {
  const { store } = await getStoreSettings();
  return (
    <div className="border-b border-border laptop:border-b-0">
      <Container className="flex h-16 items-center gap-3 laptop:h-23.25 laptop:justify-between">
        <HeaderBackButton />
        <Logo name={store.name} logoUrl={store.logoUrl} />
        <SearchForm className="hidden laptop:block laptop:max-w-124.5 laptop:flex-none laptop:basis-124.5" />
        <div className="ml-auto flex items-center gap-1 laptop:ml-0 laptop:gap-4">
          {/* Below laptop: search is its own screen (also the Search tab). */}
          <Link
            href="/search"
            aria-label="Search products"
            className="tap-target press grid place-items-center text-foreground laptop:hidden"
          >
            <SearchIcon aria-hidden className="size-6 stroke-[1.5]" />
          </Link>
          <WishlistLink />
          <span aria-hidden className="hidden h-6 w-px bg-border laptop:block" />
          <CartDrawer />
        </div>
      </Container>
    </div>
  );
}

async function NavBar() {
  const { store } = await getStoreSettings();
  return (
    <nav aria-label="Main" className="hidden bg-muted-strong laptop:block">
      <Container className="flex h-14 items-center gap-8">
        <Suspense fallback={<AllCategoriesTrigger disabled />}>
          <AllCategoriesMenu />
        </Suspense>
        <NavLinks links={siteConfig.mainNav} className="flex items-center gap-8 text-copy" />
        <a
          href={`tel:${store.contactPhone}`}
          className="ml-auto flex items-center gap-2 text-copy font-medium text-foreground hover:text-primary"
        >
          <PhoneCallIcon aria-hidden className="size-6 stroke-[1.5]" />
          {phoneLabel(store.contactPhone)}
        </a>
      </Container>
    </nav>
  );
}

function AllCategoriesTrigger({ disabled }: { disabled?: boolean }) {
  return (
    <span className="flex h-14 w-54.5 shrink-0 items-center gap-2 bg-primary px-6 text-copy font-medium text-primary-foreground data-disabled:opacity-80" data-disabled={disabled || undefined}>
      <MenuIcon aria-hidden className="size-6" />
      <span className="flex-1">All Categories</span>
      <ChevronDownIcon aria-hidden className="size-4" />
    </span>
  );
}

async function AllCategoriesMenu() {
  await connection(); // DB read at request time (cached by getCategoryTree); no DB needed at build
  const categories = await getCategoryTree();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <AllCategoriesTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-54.5 rounded-none p-0 shadow-dropdown">
        {categories.flatMap((c) => [
          <DropdownMenuItem key={c.id} asChild className="rounded-none px-6 py-2.5 text-copy">
            <Link href={`/shop?category=${c.slug}`}>{c.name}</Link>
          </DropdownMenuItem>,
          ...c.children.map((child) => (
            <DropdownMenuItem key={child.id} asChild className="rounded-none py-2 ps-10 pe-6 text-copy text-muted-foreground">
              <Link href={`/shop?category=${child.slug}`}>{child.name}</Link>
            </DropdownMenuItem>
          )),
        ])}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
