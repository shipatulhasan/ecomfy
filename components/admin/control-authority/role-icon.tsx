import {
  ChartColumnIcon,
  HeadsetIcon,
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  PencilIcon,
  TruckIcon,
  UserIcon,
  UserRoundCogIcon,
} from "lucide-react";
import { isRoleIconKey, type RoleIconKey } from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

/** Add Members.png role glyphs: house (Super Admin), user-tie, pen, headset. */
const ICONS: Record<RoleIconKey, LucideIcon> = {
  shield: HouseIcon,
  manager: UserRoundCogIcon,
  editor: PencilIcon,
  support: HeadsetIcon,
  user: UserIcon,
  box: PackageIcon,
  truck: TruckIcon,
  chart: ChartColumnIcon,
};

export function RoleIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[isRoleIconKey(icon) ? icon : "user"];
  return <Icon aria-hidden className={cn("size-5.5", className)} />;
}
