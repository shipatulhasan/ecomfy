import { redirect } from "next/navigation";

/** /admin/team is the Control Authority page (Add Members.png). */
export default function TeamPage() {
  redirect("/admin/control-authority");
}
