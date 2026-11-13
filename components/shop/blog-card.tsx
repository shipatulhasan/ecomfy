import { ArrowRightIcon, MessageSquareIcon, TagIcon, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { NewsPost } from "@/lib/config/home";
import { laptopSizes } from "@/lib/image-sizes";

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** Latest News / Blog list card (Figma "Blog Card" 424×494). */
export function BlogCard({ post }: { post: NewsPost }) {
  const date = new Date(post.date);
  return (
    <article className="group/blog relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-dropdown">
      <div className="relative aspect-[424/324] overflow-hidden">
        <Image
          src={post.image.url}
          alt=""
          fill
          sizes={`${laptopSizes(424)}, (width >= 48rem) 50vw, 100vw`}
          className="object-cover transition-[scale] duration-700 ease-out motion-safe:laptop:group-hover/blog:scale-105"
        />
        <time
          dateTime={post.date}
          className="absolute bottom-6 left-6 flex size-14.5 flex-col items-center justify-center rounded-sm bg-background/90 leading-tight"
        >
          <span className="text-h4 font-medium text-foreground">{date.getUTCDate()}</span>
          <span className="text-caption uppercase tracking-wide text-muted-foreground">{monthFmt.format(date)}</span>
        </time>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-copy text-text-body">
          <li className="flex items-center gap-1">
            <TagIcon aria-hidden className="size-4 text-muted-foreground" />
            {post.tag}
          </li>
          <li className="flex items-center gap-1">
            <UserIcon aria-hidden className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">By</span> {post.author}
          </li>
          <li className="flex items-center gap-1">
            <MessageSquareIcon aria-hidden className="size-4 text-muted-foreground" />
            {post.comments} Comments
          </li>
        </ul>
        <h3 className="text-[1.125rem] leading-normal font-medium text-foreground transition-colors group-hover/blog:text-brand-dark">
          <Link href={post.href} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h3>
        <span aria-hidden className="mt-auto inline-flex items-center gap-3 pt-2 text-lead font-semibold text-primary">
          Read More <ArrowRightIcon className="size-5 transition-transform duration-300 motion-safe:group-hover/blog:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
