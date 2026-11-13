"use client";

import { PlayIcon } from "lucide-react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { pdpCopy } from "@/lib/config/product";
import { laptopSizes } from "@/lib/image-sizes";
import { cn } from "@/lib/utils";

/**
 * Video poster beside the description (PNG "Video" 536×300) with the 50px primary
 * play button. Play opens the video in a dialog: YouTube links play in a
 * privacy-enhanced embed, anything else in a native <video>. Without a video the
 * poster shows on its own.
 */
export function ProductVideo({
  name,
  posterUrl,
  videoUrl,
  className,
}: {
  name: string;
  posterUrl: string;
  videoUrl: string | null;
  className?: string;
}) {
  const poster = (
    <Image
      src={posterUrl}
      alt={videoUrl ? "" : name}
      fill
      sizes={`${laptopSizes(536)}, 100vw`}
      className="object-cover"
    />
  );
  const frame = "relative block aspect-[536/300] w-full overflow-hidden rounded-lg bg-muted";

  if (!videoUrl) return <div className={cn(frame, className)}>{poster}</div>;

  const embed = youTubeEmbed(videoUrl);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" aria-label={pdpCopy.playVideo} className={cn(frame, "press group", className)}>
          {poster}
          <span className="absolute top-1/2 left-1/2 grid size-12.5 -translate-1/2 place-items-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-110 motion-reduce:transition-none">
            <PlayIcon aria-hidden className="size-5 translate-x-px fill-current" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(56rem,calc(100%-2rem))] overflow-hidden bg-foreground p-0 tablet:max-w-[min(56rem,calc(100%-2rem))]">
        <DialogTitle className="sr-only">{pdpCopy.videoTitle(name)}</DialogTitle>
        <div className="aspect-video w-full">
          {embed ? (
            <iframe
              src={embed}
              title={pdpCopy.videoTitle(name)}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="size-full border-0"
            />
          ) : (
            <video src={videoUrl} controls autoPlay playsInline className="size-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function youTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : host.endsWith("youtube.com")
          ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null)
          : null;
    return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
  } catch {
    return null;
  }
}
