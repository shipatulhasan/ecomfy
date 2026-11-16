import { ConstructionIcon } from "@/components/admin/icons";
import { Container } from "@/components/shared/container";

/**
 * In-shell placeholder for admin pages that aren't built yet. Linked from the menu,
 * the dashboard and search, so it must never be a 404.
 */
export function ComingSoon({ title, detail }: { title: string; detail?: string }) {
  return (
    <Container variant="admin" className="py-section">
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary">
          <ConstructionIcon aria-hidden className="size-7" />
        </span>
        <h2 className="text-h2 text-foreground">{title}</h2>
        <p className="max-w-md text-copy text-muted-foreground">
          {detail ?? "This section is coming soon. It will appear here as soon as it's built."}
        </p>
      </div>
    </Container>
  );
}
