import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Transactions may queue for the connection a little while: the local database
// runs on a single connection (see scripts/local.mjs).
export const db = globalForPrisma.prisma ?? new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 15_000 } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
