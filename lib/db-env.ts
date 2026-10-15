// Which database to use, from whichever variables the hosting set up. Vercel's
// database integrations name them differently:
//
//   Neon                      DATABASE_URL (pooled) + DATABASE_URL_UNPOOLED (direct)
//   Prisma Postgres           DATABASE_URL (direct)
//   Supabase, Vercel Postgres POSTGRES_PRISMA_URL / POSTGRES_URL (pooled) + POSTGRES_URL_NON_POOLING (direct)
//
// The app runs on `url`. Migrations (run during the Vercel build) need a direct,
// unpooled connection: `directUrl`. Used by lib/db.ts and scripts/vercel-build.ts.
// Plain module, no imports: the build script loads it outside Next.js.

/** Where the app's connection comes from, in order of preference. */
export const URL_VARS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"] as const;
/** Where a direct connection for migrations comes from, in order of preference. */
export const DIRECT_URL_VARS = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DIRECT_URL"] as const;

type Env = Record<string, string | undefined>;

export interface DatabaseUrls {
  url: string;
  directUrl: string;
  /** Where each came from, for messages. Never print the URLs: they hold the password. */
  urlFrom: string;
  directFrom: string;
}

const firstSet = (env: Env, names: readonly string[]) => names.find((n) => env[n]?.trim());

/** Neon's pooled host is its direct host with "-pooler" after the endpoint id
 *  (ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech). Null if it isn't one. */
export function neonDirectUrl(url: string): string | null {
  const direct = url.replace(/@(ep-[a-z0-9-]+?)-pooler\./i, "@$1.");
  return direct === url ? null : direct;
}

export function resolveDatabaseUrls(env: Env): DatabaseUrls | null {
  const urlFrom = firstSet(env, URL_VARS);
  if (!urlFrom) return null;
  const url = env[urlFrom]!.trim();

  const directVar = firstSet(env, DIRECT_URL_VARS);
  if (directVar) return { url, urlFrom, directUrl: env[directVar]!.trim(), directFrom: directVar };
  const neon = neonDirectUrl(url);
  if (neon) return { url, urlFrom, directUrl: neon, directFrom: `${urlFrom}, with Neon's direct host` };
  // Not a known pooler: the same connection does for migrations.
  return { url, urlFrom, directUrl: url, directFrom: urlFrom };
}
