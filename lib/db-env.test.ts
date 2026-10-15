import { expect, it } from "vitest";
import { neonDirectUrl, resolveDatabaseUrls } from "./db-env";

const NEON_POOLED = "postgresql://neondb_owner:p%40ss@ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEON_DIRECT = "postgresql://neondb_owner:p%40ss@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

it("uses the Neon integration's two variables", () => {
  expect(resolveDatabaseUrls({ DATABASE_URL: NEON_POOLED, DATABASE_URL_UNPOOLED: NEON_DIRECT })).toEqual({
    url: NEON_POOLED,
    urlFrom: "DATABASE_URL",
    directUrl: NEON_DIRECT,
    directFrom: "DATABASE_URL_UNPOOLED",
  });
});

it("finds Neon's direct host when only the pooled URL is set", () => {
  expect(neonDirectUrl(NEON_POOLED)).toBe(NEON_DIRECT);
  expect(neonDirectUrl(NEON_DIRECT)).toBe(null);
  expect(resolveDatabaseUrls({ DATABASE_URL: NEON_POOLED })).toMatchObject({ directUrl: NEON_DIRECT, directFrom: "DATABASE_URL, with Neon's direct host" });
});

it("uses a single direct URL (Prisma Postgres, own server) for both", () => {
  const url = "postgres://user:secret@db.prisma.io:5432/postgres?sslmode=require";
  expect(resolveDatabaseUrls({ DATABASE_URL: url, POSTGRES_URL: url })).toEqual({ url, urlFrom: "DATABASE_URL", directUrl: url, directFrom: "DATABASE_URL" });
});

it("falls back to the Supabase / Vercel Postgres names", () => {
  expect(resolveDatabaseUrls({ POSTGRES_URL: "postgres://a", POSTGRES_PRISMA_URL: "postgres://b", POSTGRES_URL_NON_POOLING: "postgres://c" })).toEqual({
    url: "postgres://b",
    urlFrom: "POSTGRES_PRISMA_URL",
    directUrl: "postgres://c",
    directFrom: "POSTGRES_URL_NON_POOLING",
  });
});

it("ignores blank variables and reports no database", () => {
  expect(resolveDatabaseUrls({})).toBe(null);
  expect(resolveDatabaseUrls({ DATABASE_URL: "  ", DATABASE_URL_UNPOOLED: "postgres://x" })).toBe(null);
  expect(resolveDatabaseUrls({ DATABASE_URL: "postgres://a", DATABASE_URL_UNPOOLED: "" })).toMatchObject({ directUrl: "postgres://a" });
});
