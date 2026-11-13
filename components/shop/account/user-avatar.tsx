import Image from "next/image";
import { cn } from "@/lib/utils";
import { UserAvatarFallback } from "./user-avatar-fallback";

/**
 * Profile photo (uploaded in Settings, or Google's) or the initials on a soft
 * green disc. `size` is the rendered size in design px at laptop+ (rem-scaled).
 */
export function UserAvatar({
  name,
  image,
  className,
  sizes,
}: {
  name: string;
  image: string | null;
  className?: string;
  /** next/image `sizes` for the rendered box. */
  sizes: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground",
        className,
      )}
    >
      {image ? (
        <Image src={image} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <UserAvatarFallback name={name} />
      )}
    </span>
  );
}
