/**
 * pnpm tsx scripts/check-team.ts
 *
 * Exercises the Control Authority rules (lib/admin/team-rules.ts) against the dev
 * DB. Every case runs inside a transaction that is rolled back, so nothing is
 * left behind:
 *   - nobody changes their own role / deactivates / removes themselves;
 *   - the last active Super Admin can't be demoted, deactivated or removed;
 *   - deactivate and role changes delete the member's sessions;
 *   - remove is soft (User row stays, role → CUSTOMER);
 *   - a second Super Admin makes demoting the first one possible.
 * Needs the seed (admin@ / staff@ecomfy.test).
 */
import { randomUUID } from "node:crypto";
import { DEFAULT_STAFF_ROLE_ID, SUPER_ADMIN_ROLE_ID } from "../lib/admin/roles";
import { changeMemberRole, removeMember, setMemberActive } from "../lib/admin/team-rules";
import type { Prisma } from "../lib/generated/prisma/client";
import { prisma } from "./lib-db";

const ROLLBACK = Symbol("rollback");
let failed = 0;

async function inTx(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

async function expectError(name: string, fn: () => Promise<unknown>, match: RegExp) {
  try {
    await fn();
    failed++;
    console.log(`✖ ${name}: expected an error`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (match.test(msg)) console.log(`✔ ${name}`);
    else {
      failed++;
      console.log(`✖ ${name}: unexpected error "${msg}"`);
    }
  }
}

function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`✔ ${name}`);
  else {
    failed++;
    console.log(`✖ ${name} ${detail}`);
  }
}

const addSession = (tx: Prisma.TransactionClient, userId: string) =>
  tx.session.create({ data: { id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date(Date.now() + 86_400_000) } });

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@ecomfy.test" }, select: { id: true } });
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: "staff@ecomfy.test" }, select: { id: true } });
  const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", deactivatedAt: null, id: { not: admin.id } } });
  if (otherAdmins > 0) console.log(`(note: ${otherAdmins} other active Super Admin(s); the last-admin cases make them inactive inside the tx)`);

  await inTx(async (tx) => {
    await tx.user.updateMany({ where: { role: "ADMIN", id: { not: admin.id } }, data: { deactivatedAt: new Date() } });
    await expectError("self role change rejected", () => changeMemberRole(tx, admin.id, admin.id, DEFAULT_STAFF_ROLE_ID), /own access/);
  });
  await inTx(async (tx) => {
    await expectError("self deactivate rejected", () => setMemberActive(tx, admin.id, admin.id, false), /own access/);
  });
  await inTx(async (tx) => {
    await expectError("self remove rejected", () => removeMember(tx, admin.id, admin.id), /own access/);
  });

  // Last active Super Admin, acted on by a (hypothetical) second admin: promote staff, then try.
  for (const [name, run] of [
    ["last Super Admin demote rejected", (tx: Prisma.TransactionClient) => changeMemberRole(tx, staff.id, admin.id, DEFAULT_STAFF_ROLE_ID)],
    ["last Super Admin deactivate rejected", (tx: Prisma.TransactionClient) => setMemberActive(tx, staff.id, admin.id, false)],
    ["last Super Admin remove rejected", (tx: Prisma.TransactionClient) => removeMember(tx, staff.id, admin.id)],
  ] as const) {
    await inTx(async (tx) => {
      await tx.user.updateMany({ where: { role: "ADMIN", id: { not: admin.id } }, data: { deactivatedAt: new Date() } });
      // staff acts as the caller; they're STAFF in the DB, which is enough for the rule itself.
      await expectError(name, () => run(tx), /last active Super Admin/);
    });
  }

  await inTx(async (tx) => {
    await tx.user.updateMany({ where: { role: "ADMIN", id: { not: admin.id } }, data: { deactivatedAt: new Date() } });
    await changeMemberRole(tx, admin.id, staff.id, SUPER_ADMIN_ROLE_ID);
    const change = await changeMemberRole(tx, staff.id, admin.id, DEFAULT_STAFF_ROLE_ID);
    check("demote allowed once another Super Admin exists", change.after.role === "STAFF");
  });

  await inTx(async (tx) => {
    await addSession(tx, staff.id);
    await setMemberActive(tx, admin.id, staff.id, false);
    const sessions = await tx.session.count({ where: { userId: staff.id } });
    const row = await tx.user.findUniqueOrThrow({ where: { id: staff.id }, select: { deactivatedAt: true } });
    check("deactivate deletes sessions", sessions === 0, `(${sessions} left)`);
    check("deactivate sets deactivatedAt", !!row.deactivatedAt);
  });

  await inTx(async (tx) => {
    await addSession(tx, staff.id);
    await changeMemberRole(tx, admin.id, staff.id, "role_editor");
    const sessions = await tx.session.count({ where: { userId: staff.id } });
    const row = await tx.user.findUniqueOrThrow({ where: { id: staff.id }, select: { role: true, staffRoleId: true } });
    check("role change applies + revokes sessions", sessions === 0 && row.role === "STAFF" && row.staffRoleId === "role_editor");
  });

  await inTx(async (tx) => {
    await removeMember(tx, admin.id, staff.id);
    const row = await tx.user.findUnique({ where: { id: staff.id }, select: { role: true, staffRoleId: true } });
    check("remove is soft (row kept, role CUSTOMER)", row?.role === "CUSTOMER" && row.staffRoleId === null);
  });

  await inTx(async (tx) => {
    const customer = await tx.user.findFirstOrThrow({ where: { role: "CUSTOMER" }, select: { id: true } });
    await expectError("customer isn't a team member", () => setMemberActive(tx, admin.id, customer.id, false), /no longer exists/);
  });

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll team rule checks passed");
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
