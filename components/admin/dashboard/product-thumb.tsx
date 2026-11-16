import { PackageIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** Square product photo on a muted tile (56 in Top Products, 36 in Best selling). */
export function ProductThumb({ src, size, className }: { src: string | null; size: number; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-contain p-1" />
      ) : (
        <PackageIcon aria-hidden className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}
