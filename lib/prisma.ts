import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = process.env["DATABASE_URL"] ?? "";

  const pool = new Pool({
    connectionString,
    // Use verify-full explicitly to silence the pg SSL deprecation warning
    // and ensure maximum security for connections to Neon / other hosted PG.
    ssl: { rejectUnauthorized: true },
    max: 20, // Increased to handle more concurrent HMR/Dev requests
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased to 10s to allow for Neon cold starts
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env["NODE_ENV"] === "development"
        ? ["error", "warn"]
        : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
