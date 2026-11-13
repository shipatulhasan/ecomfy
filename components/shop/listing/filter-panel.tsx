import { connection } from "next/server";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { shopContent } from "@/lib/config/shop";
import { getShopFilterOptions } from "@/lib/queries/products";
import { cn } from "@/lib/utils";
import { BrandFilter, CategoryFilter, PriceFilter, RatingFilter, StockFilter, TagFilter } from "./filters";

const SECTIONS = ["categories", "price", "rating", "tags", "brands", "availability"] as const;

/**
 * The Shop filter sidebar (Shop.png): collapsible sections separated by lines.
 * Used in the laptop+ sidebar and in the mobile/tablet Sheet. Options are cached
 * ("use cache" + products/categories tags); the controls are client leaves that
 * read the URL, so render this inside <Suspense>.
 */
export async function FilterPanel({ className }: { className?: string }) {
  await connection();
  const options = await getShopFilterOptions();
  const t = shopContent.filters;

  return (
    <Accordion type="multiple" defaultValue={[...SECTIONS]} className={cn("border-b border-border", className)}>
      <Section value="categories" title={t.categories}>
        <CategoryFilter categories={options.categories} />
      </Section>
      <Section value="price" title={t.price}>
        <PriceFilter bounds={options.price} />
      </Section>
      <Section value="rating" title={t.rating}>
        <RatingFilter />
      </Section>
      <Section value="tags" title={t.tags}>
        <TagFilter tags={options.tags} />
      </Section>
      {options.brands.length > 0 && (
        <Section value="brands" title={t.brands}>
          <BrandFilter brands={options.brands} />
        </Section>
      )}
      <Section value="availability" title={t.availability}>
        <StockFilter />
      </Section>
    </Accordion>
  );
}

function Section({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-border">
      <AccordionTrigger className="items-center py-4 text-foreground hover:no-underline laptop:pt-5 [&_[data-slot=accordion-trigger-icon]]:size-4.5">
        {/* span: the trigger's own text-sm would win over a text-h4 on the trigger */}
        <span className="text-h4 font-medium">{title}</span>
      </AccordionTrigger>
      <AccordionContent className="pb-6">{children}</AccordionContent>
    </AccordionItem>
  );
}
