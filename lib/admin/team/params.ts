/**
 * Control Authority URL state (pure; parsed on the page, built by client links):
 *   ?role=<staffRoleId>   selected role (System Roles list → Members + Permissions)
 *   ?rq=                  "Search Role"
 *   ?q=&mrole=&status=    All members table: search, role filter, status filter
 *   ?new=role | ?edit=<staffRoleId>   Create / Edit role modal
 */
export const MEMBER_STATUSES = ["all", "active", "deactivated", "invited"] as const;
export type MemberStatusFilter = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABEL: Record<MemberStatusFilter, string> = {
  all: "All",
  active: "Active",
  deactivated: "Deactivated",
  invited: "Invited",
};

export type TeamParams = {
  role: string | null;
  rq: string;
  q: string;
  mrole: string | null;
  status: MemberStatusFilter;
  modal: { kind: "new" } | { kind: "edit"; id: string } | null;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const idOrNull = (v: string) => (/^[\w-]{1,64}$/.test(v) ? v : null);

export function parseTeamParams(sp: Raw): TeamParams {
  const status = one(sp.status);
  const edit = idOrNull(one(sp.edit));
  return {
    role: idOrNull(one(sp.role)),
    rq: one(sp.rq).trim().slice(0, 60),
    q: one(sp.q).trim().slice(0, 100),
    mrole: idOrNull(one(sp.mrole)),
    status: (MEMBER_STATUSES as readonly string[]).includes(status) ? (status as MemberStatusFilter) : "all",
    modal: one(sp.new) === "role" ? { kind: "new" } : edit ? { kind: "edit", id: edit } : null,
  };
}

export function teamQuery(p: TeamParams, patch: Partial<Omit<TeamParams, "modal">> & { modal?: TeamParams["modal"] } = {}): string {
  const n = { ...p, modal: null, ...patch };
  const qs = new URLSearchParams();
  if (n.role) qs.set("role", n.role);
  if (n.rq) qs.set("rq", n.rq);
  if (n.q) qs.set("q", n.q);
  if (n.mrole) qs.set("mrole", n.mrole);
  if (n.status !== "all") qs.set("status", n.status);
  if (n.modal?.kind === "new") qs.set("new", "role");
  if (n.modal?.kind === "edit") qs.set("edit", n.modal.id);
  return qs.toString();
}

export const teamHref = (p: TeamParams, patch: Parameters<typeof teamQuery>[1] = {}) => {
  const q = teamQuery(p, patch);
  return `/admin/control-authority${q ? `?${q}` : ""}`;
};
