import { Rail, RailItem } from "@/components/shared/rail";
import type { NewsPost, Section } from "@/lib/config/home";
import { BlogCard } from "../blog-card";
import { SectionHeading } from "../section-heading";

/** Latest News: 3 blog cards. A rail below laptop (85% / 48%), 3 columns from laptop. */
export function LatestNews({ section, posts }: { section: Section; posts: readonly NewsPost[] }) {
  return (
    <section aria-labelledby="latest-news" className="reveal flex flex-col gap-6 tablet:gap-8">
      <SectionHeading id="latest-news" section={section} align="center" />
      <Rail size="wide" laptop="grid" className="laptop:grid-cols-3 laptop:gap-6">
        {posts.map((p) => (
          <RailItem key={p.title}>
            <BlogCard post={p} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
