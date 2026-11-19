/**
 * pnpm admin:create — bootstrap the FIRST admin account.
 *
 * Refuses when any ADMIN already exists: after that, admins and staff only join
 * through invites (Control Authority → Add Members, or `pnpm admin:invite`). No web
 * route ever creates an admin without an invite.
 *
 *   pnpm admin:create                                  # prompts
 *   pnpm admin:create --email a@b.com --name "Wade Warren" --password '…'
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "better-auth/crypto";
import { flags, prisma } from "./lib-db";
import { SUPER_ADMIN_ROLE_ID } from "../lib/admin/roles";

async function ask(question: string, hidden = false): Promise<string> {
  if (!hidden) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  // Hidden input: raw mode, no echo.
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") process.exit(130);
      else if (ch === "\u007f") value = value.slice(0, -1);
      else value += ch;
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const existing = await prisma.user.count({ where: { role: "ADMIN" } });
  if (existing > 0) {
    console.error(`✖ ${existing} admin account(s) already exist. Invite new members instead (pnpm admin:invite <email> <STAFF|ADMIN>).`);
    process.exitCode = 1;
    return;
  }

  const f = flags();
  const email = (f.email || (await ask("Email: "))).toLowerCase();
  const name = f.name || (await ask("Full name: "));
  const password = f.password || (await ask("Password (8+ chars): ", true));

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
  if (!name) throw new Error("Name is required.");
  if (password.length < 8 || password.length > 128) throw new Error("Password must be 8–128 characters.");

  const hash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const found = await tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
    const id = found?.id ?? randomUUID();
    if (found) {
      // Promote an existing account (e.g. the owner's storefront account) and set its password.
      await tx.user.update({ where: { id }, data: { role: "ADMIN", staffRoleId: SUPER_ADMIN_ROLE_ID, deactivatedAt: null, emailVerified: true } });
      await tx.account.deleteMany({ where: { userId: id, providerId: "credential" } });
      await tx.session.deleteMany({ where: { userId: id } });
    } else {
      await tx.user.create({ data: { id, name, email, emailVerified: true, role: "ADMIN", staffRoleId: SUPER_ADMIN_ROLE_ID } });
    }
    await tx.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash } });
    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "admin.bootstrap",
        entity: "User",
        entityId: id,
        before: found ? { role: found.role } : undefined,
        after: { email, role: "ADMIN" },
      },
    });
    return { id, email };
  });
  console.log(`✔ Admin ${user.email} created. Sign in at /admin/login.`);
}

main()
  .catch((err) => {
    console.error(`✖ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
