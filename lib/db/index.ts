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

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
