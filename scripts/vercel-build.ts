// Vercel's build step (`npm run vercel-build`): check the project's settings,
// bring the database tables up to date, then build the app.
//
// Problems are listed all at once with what to do about each, instead of
// failing on the first missing setting deep inside Prisma or Next.js.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { DIRECT_URL_VARS, resolveDatabaseUrls, URL_VARS } from "../lib/db-env";
import { TEAM_PASSWORD_MIN_LENGTH, teamPassword } from "../lib/team-password";

const env = process.env;
const require = createRequire(import.meta.url);
const SETTINGS = "Vercel → your project → Settings → Environment Variables";
// "production" or "preview": settings can be set for one and not the other.
const scope = env.VERCEL_ENV ? ` (this is a ${env.VERCEL_ENV} deployment)` : "";

const problems: string[] = [];
const warnings: string[] = [];

const db = resolveDatabaseUrls(env);
if (!db) {
  problems.push(
    `No database. In Vercel open the project's Storage tab and connect a Postgres database (Neon) to this project, ` +
      `for Production and Preview. That sets DATABASE_URL. (Also accepted: ${URL_VARS.slice(1).join(", ")}.)`,
  );
}
if (!env.AUTH_SECRET?.trim() && !env.NEXTAUTH_SECRET?.trim()) {
  problems.push(`AUTH_SECRET is missing. Sign-in needs it. Make one with \`openssl rand -base64 32\` and add it in ${SETTINGS}.`);
}
const team = teamPassword(env);
if (team && team.length < TEAM_PASSWORD_MIN_LENGTH) {
  problems.push(`TEAM_PASSWORD is too short: use at least ${TEAM_PASSWORD_MIN_LENGTH} characters, e.g. a few words like "belts-and-bearings-friday".`);
}
if (team) {
  warnings.push(
    "TEAM_PASSWORD is still set: anyone who knows it can sign in as any account that has no password of its own yet. " +
      "Once everyone has their own password (People page), delete TEAM_PASSWORD and redeploy.",
  );
}
if (!env.AUTH_RESEND_KEY?.trim()) {
  warnings.push("AUTH_RESEND_KEY is missing: the daily email and email sign-in links can't be sent (password sign-in still works).");
}
if (!env.EMAIL_FROM?.trim()) {
  warnings.push("EMAIL_FROM is missing: emails come from Resend's test sender, which only delivers to your own Resend account's address.");
}
if (!env.CRON_SECRET?.trim()) warnings.push("CRON_SECRET is missing: the daily email won't be sent.");

console.log(`\nPM System — checking settings${scope}`);
if (db) {
  console.log(`  ✓ Database: ${db.urlFrom}`);
  console.log(`  ✓ Migrations connect with: ${db.directFrom}`);
}
if (!problems.some((p) => p.startsWith("AUTH_SECRET"))) console.log("  ✓ AUTH_SECRET");
for (const w of warnings) console.log(`  ! ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\nThe build stopped: fix the ✗ items in ${SETTINGS}, then redeploy (Deployments → ⋯ → Redeploy).\n`);
  process.exit(1);
}

/** Run a package's command-line tool with the database settings filled in. */
function run(bin: string, args: string[]) {
  console.log(`\n> ${bin.split("/")[0]} ${args.join(" ")}`);
  const r = spawnSync(process.execPath, [require.resolve(bin), ...args], {
    stdio: "inherit",
    // Prisma reads DATABASE_URL, and DATABASE_URL_UNPOOLED for migrations (prisma/schema.prisma).
    env: { ...env, DATABASE_URL: db!.url, [DIRECT_URL_VARS[0]]: db!.directUrl },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("prisma/build/index.js", ["generate"]);
run("prisma/build/index.js", ["migrate", "deploy"]);
run("next/dist/bin/next", ["build"]);
