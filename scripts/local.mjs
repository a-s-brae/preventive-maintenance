// Runs the PM System on this computer — no Vercel or cloud database needed.
//
//   npm run local          start it (the first run sets everything up)
//   npm run local:stop     stop the background database
//   npm run local:reset    stop the database and DELETE all local data
//   npm run local:migrate -- --name <change>   (developers) create a migration
//
// The database is Prisma's local Postgres (`prisma dev`). It runs as a small
// background process and keeps its data in your user profile, so it survives
// restarts and re-downloads of this folder.

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.env.NEXT_TELEMETRY_DISABLED = "1";

const DB = { name: "pm-system", port: 51213, dbPort: 51214, shadowPort: 51215 };
// The local database (PGlite, via `prisma dev`) is a single Postgres session,
// so the app talks to it over ONE connection: queries from two requests at once
// (or two transactions) on separate connections get mixed up. pgbouncer=true
// turns off named prepared statements, which would clash when the connection
// is reopened in the same session.
const tcpUrl = (port, limit) =>
  `postgresql://postgres:postgres@localhost:${port}/template1?sslmode=disable&connection_limit=${limit}&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0`;
const LOCAL_DB_URL = `${tcpUrl(DB.dbPort, 1)}&pgbouncer=true`;
// `prisma migrate dev` (developers only) needs the dev server's shadow database.
// The api_key only carries those connection details — nothing secret.
const apiKey = Buffer.from(JSON.stringify({ name: DB.name, databaseUrl: tcpUrl(DB.dbPort, 1), shadowDatabaseUrl: tcpUrl(DB.shadowPort, 1) }));
const MIGRATE_DB_URL = `prisma+postgres://localhost:${DB.port}/?api_key=${apiKey.toString("base64url")}`;
const APP_PORT = Number(process.env.PORT) || 3000;
const APP_URL = `http://localhost:${APP_PORT}`;

const CLI = {
  prisma: path.join("node_modules", "prisma", "build", "index.js"),
  next: path.join("node_modules", "next", "dist", "bin", "next"),
};

const log = (msg) => console.log(`\n>> ${msg}`);

function fail(msg, output) {
  if (output) console.error(output);
  console.error(`\nERROR: ${msg}\n`);
  process.exit(1);
}

/** Run `prisma` or `next` from node_modules. `quiet` hides the output unless it fails. */
function runCli(name, args, { quiet = false } = {}) {
  const r = spawnSync(process.execPath, [CLI[name], ...args], { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0) fail(`Failed: ${name} ${args.join(" ")}`, quiet ? `${r.stdout}${r.stderr}` : "");
}

function hashFiles(paths) {
  const hash = createHash("sha256");
  const walk = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) walk(path.join(p, f));
    } else {
      hash.update(p).update(readFileSync(p));
    }
  };
  paths.forEach(walk);
  return hash.digest("hex");
}

/** Run `step` only when the hash of `inputs` differs from the one saved in `stampFile`. */
function whenChanged(stampFile, inputs, step) {
  const current = hashFiles(inputs);
  if (existsSync(stampFile) && readFileSync(stampFile, "utf8") === current) return;
  step();
  mkdirSync(path.dirname(stampFile), { recursive: true });
  writeFileSync(stampFile, current);
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function readEnvValue(name) {
  if (!existsSync(".env")) return undefined;
  const match = readFileSync(".env", "utf8").match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, "m"));
  return match?.[1];
}

/** .env points at the local database (in this or an earlier version's form). */
function usesLocalDb() {
  const url = readEnvValue("DATABASE_URL") ?? "";
  return url.startsWith(`prisma+postgres://localhost:${DB.port}/`) || url.startsWith(`postgresql://postgres:postgres@localhost:${DB.dbPort}/`);
}

/** Bring a local .env's database lines up to date with LOCAL_DB_URL. */
function updateLocalDbUrl() {
  const env = readFileSync(".env", "utf8");
  const next = env.replace(/^(DATABASE_URL(?:_UNPOOLED)?)\s*=.*$/gm, (_, name) => `${name}="${LOCAL_DB_URL}"`);
  if (next !== env) writeFileSync(".env", next);
}

function stopDb() {
  if (existsSync(CLI.prisma)) spawnSync(process.execPath, [CLI.prisma, "dev", "stop", DB.name], { stdio: "pipe" });
}

/** Start the local database (does nothing if it's already running). */
async function startDb() {
  runCli("prisma", ["dev", "--name", DB.name, "--port", String(DB.port), "--db-port", String(DB.dbPort), "--shadow-db-port", String(DB.shadowPort), "--detach"], {
    quiet: true,
  });
  if (!(await waitForPort(DB.dbPort, 60_000))) fail("The local database didn't start. Try `npm run local:stop`, then `npm run local` again.");
}

async function assertAppStopped() {
  if (await waitForPort(APP_PORT, 0)) {
    fail(`Port ${APP_PORT} is in use — is the PM System running in another window? Close it first. (Or pick another port: set PORT=3001)`);
  }
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function start() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 20 || (major === 20 && minor < 9)) {
    fail(`Node.js 20.9 or newer is needed (you have ${process.versions.node}). Install the LTS version from https://nodejs.org`);
  }
  await assertAppStopped();
  // Restart the database on every launch: it only takes a moment and clears
  // anything left over if the app was closed abruptly.
  stopDb();

  whenChanged(path.join("node_modules", ".pm-installed"), ["package.json", "package-lock.json"], () => {
    log("Installing dependencies (first run only — this takes a few minutes)…");
    const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { stdio: "inherit", shell: true });
    if (r.status !== 0) fail("npm install failed — check your internet connection and try again.");
  });

  if (!existsSync(".env")) {
    log("Creating .env with local settings…");
    writeFileSync(
      ".env",
      [
        "# Local settings, written by `npm run local`. See .env.example for all options.",
        `DATABASE_URL="${LOCAL_DB_URL}"`,
        `DATABASE_URL_UNPOOLED="${LOCAL_DB_URL}"`,
        `AUTH_SECRET="${randomBytes(32).toString("base64")}"`,
        "AUTH_TRUST_HOST=true",
        "# Local mode: sign in without an email check (never used on Vercel).",
        "AUTH_LOCAL_LOGIN=true",
        'ALLOWED_EMAIL_DOMAINS="as-plastech.com"',
        "",
      ].join("\n"),
    );
  }

  // Only manage the local database if .env points at it (you can point
  // .env at a cloud database such as Neon instead).
  if (usesLocalDb()) {
    updateLocalDbUrl();
    log("Starting the local database…");
    await startDb();
  }

  log("Updating the database tables…");
  runCli("prisma", ["migrate", "deploy"], { quiet: true });

  whenChanged(
    path.join(".next", ".pm-built"),
    ["app", "components", "lib", "auth.ts", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "prisma/schema.prisma", "package-lock.json"],
    () => {
      log("Building the app (only after an update — about a minute)…");
      runCli("prisma", ["generate"], { quiet: true });
      runCli("next", ["build"]);
    },
  );

  log("Starting the PM System…");
  const app = spawn(process.execPath, [CLI.next, "start", "--port", String(APP_PORT)], { stdio: "inherit" });
  app.on("exit", (code) => process.exit(code ?? 0));
  // Ctrl+C reaches the app directly; wait for it to shut down.
  process.on("SIGINT", () => {});

  if (await waitForPort(APP_PORT, 60_000)) {
    console.log(`\n>> PM System is running at ${APP_URL}`);
    // Phones on the same Wi-Fi (e.g. scanning QR labels) use the network address.
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."));
    if (lan) console.log(`  On other devices on this network: http://${lan.address}:${APP_PORT}`);
    console.log("  Keep this window open while you use it. Press Ctrl+C to stop.\n");
    if (!process.argv.includes("--no-open")) openBrowser(APP_URL);
  }
}

/** For developers: `prisma migrate dev` after a schema change, against the
 *  local database only (it can reset the database it runs on). */
async function migrate() {
  if (!usesLocalDb()) fail("local:migrate only runs against the local database. Run `npm run local` first to set it up.");
  await startDb();
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED = MIGRATE_DB_URL;
  runCli("prisma", ["migrate", "dev", ...process.argv.slice(3)]);
}

function stop() {
  stopDb();
  console.log("Local database stopped.");
}

async function reset() {
  await assertAppStopped();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("This permanently deletes ALL local PM data (assets, tasks, history). Type DELETE to confirm: ");
  rl.close();
  if (answer.trim() !== "DELETE") return console.log("Cancelled — nothing was deleted.");
  stopDb();
  runCli("prisma", ["dev", "rm", DB.name], { quiet: true });
  console.log("Local data deleted. Run `npm run local` to start fresh.");
}

const command = process.argv[2] ?? "start";
const commands = { start, stop, reset, migrate };
if (!commands[command]) fail(`Unknown command "${command}". Use: start, stop, reset, or migrate.`);
await commands[command]();
