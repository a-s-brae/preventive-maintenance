import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrls } from "@/lib/db-env";

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The connection comes from DATABASE_URL or another integration's name for it
// (see lib/db-env.ts); with none set, Prisma reports DATABASE_URL as missing.
const urls = resolveDatabaseUrls(process.env);

// Transactions may queue for the connection a little while: the local database
// runs on a single connection (see scripts/local.mjs).
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ ...(urls && { datasourceUrl: urls.url }), transactionOptions: { maxWait: 10_000, timeout: 15_000 } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
