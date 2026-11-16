/** Prisma client for CLI scripts (direct connection, like prisma/seed.ts). */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and DIRECT_URL) in .env first.");

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** `--email x --name "A B"` → { email: "x", name: "A B" }. */
export function flags(argv = process.argv.slice(2)): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      out[k!] = v ?? argv[++i] ?? "";
    }
  }
  return out;
}
