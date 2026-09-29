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
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.env.NEXT_TELEMETRY_DISABLED = "1";

const DB = { name: "pm-system", port: 51213, dbPort: 51214, shadowPort: 51215 };
// The app reaches the local database through the Prisma dev server
// (prisma+postgres://), which keeps each client's queries separate. Its api_key
// only carries the underlying connection details — nothing secret.
const tcpUrl = (port) =>
  `postgres://postgres:postgres@localhost:${port}/template1?sslmode=disable&connection_limit=10&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&socket_timeout=0`;
const apiKey = Buffer.from(JSON.stringify({ name: DB.name, databaseUrl: tcpUrl(DB.dbPort), shadowDatabaseUrl: tcpUrl(DB.shadowPort) }));
const LOCAL_DB_URL = `prisma+postgres://localhost:${DB.port}/?api_key=${apiKey.toString("base64url")}`;
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

const usesLocalDb = () => !!readEnvValue("DATABASE_URL")?.startsWith(`prisma+postgres://localhost:${DB.port}/`);

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
    console.log("  Keep this window open while you use it. Press Ctrl+C to stop.\n");
    if (!process.argv.includes("--no-open")) openBrowser(APP_URL);
  }
}

/** For developers: `prisma migrate dev` after a schema change, against the
 *  local database only (it can reset the database it runs on). */
async function migrate() {
  if (!usesLocalDb()) fail("local:migrate only runs against the local database. Run `npm run local` first to set it up.");
  await startDb();
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
