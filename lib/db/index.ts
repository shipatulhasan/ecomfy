import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Runtime uses the pooled DATABASE_URL (Neon "-pooler" host). Migrations use
// DIRECT_URL via prisma.config.ts. Not validated at import time so `next build`
// works without a database; the first query fails clearly if it is missing.
function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

// Reuse one client across hot reloads in dev. The cache is keyed on the
// generated PrismaClient class: after `prisma generate` (schema change, migrate,
// pnpm install) the module is new, so a client built from the old schema is
// dropped instead of failing every query on new fields ("Unknown argument …").
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient };

const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
if (!cached && globalForPrisma.prisma) void globalForPrisma.prisma.$disconnect().catch(() => {});

export const prisma = cached ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}
