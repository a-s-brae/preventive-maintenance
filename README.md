# PM System

Preventive maintenance tracking for A.S. Plastech. It tracks equipment, runs recurring PM
schedules (by calendar, by usage, or both), gives techs checklists to complete, and
keeps a full work history.

**Stack:** Next.js 16 (App Router, server actions) · Prisma 6 · Neon Postgres ·
Auth.js v5 email magic links (via Resend) · Tailwind CSS 4. It runs on one
computer (`npm run local`) or hosted on Vercel.

## What it does

| Area | Details |
|------|---------|
| **Work orders** | The unit of maintenance work: numbered (WO-0001), with type (PM, repair, inspection), status (open, in progress, on hold, complete), priority, assignee, due date, checklist and completion notes. List, "assigned to me", completed and calendar views. |
| **PM schedules** | Each asset can have many. Interval by **calendar** (every N days/weeks/months/years), **usage** (every N meter units), or **both** (whichever comes first). When one comes due it **creates a work order** automatically, with its checklist, priority and default assignee. "Start early" creates it before it's due. |
| **Fixed vs. from completion** | After each completion, the next calendar due date is either counted from when it was done, or kept on a **fixed calendar** (e.g. the 1st of every month) — for compliance checks. |
| **Checklists** | Items can be a checkbox, **pass / fail**, a **number** reading (with unit, e.g. psi) or **text**. Answers are saved with the completed work order; failed items are flagged in the history. |
| **Reading limits & follow-ups** | A number reading can have a min / max (e.g. tank pressure 90–125 psi). Readings outside it are flagged as they're typed. When an inspection finds problems (a fail or a reading out of limits), completing it offers a **follow-up repair work order** listing them, linked both ways. |
| **Due status** | **Overdue**, **Due soon**, or **OK**. A PM's work order is created N days before its calendar date (capped at ¼ of the interval) or in the last 10% of its usage interval. |
| **Assets** | Name, tag, category, location, make/model/serial, status (active / inactive / retired), optional meter (hours, cycles, miles…). Asset pages show open work orders, PM schedules and history. |
| **Meter readings** | Log a reading any time (or when completing a work order). Readings can't go backwards. |
| **Checklist autosave** | Each answer (and its optional note) is saved the moment it's entered, so a PM interrupted halfway keeps its answers. The first answer moves the work order to In progress. |
| **Lists** | Filter chips for due / status / priority, search, and **Export to Excel (CSV) under More** on work orders, PM schedules and assets (the export matches the filters on screen). |
| **Navigation** | A light sidebar in groups — Overview (Dashboard, Reports), Maintenance (Work orders, Requests, PM schedules, Equipment, Parts), Admin (People) — with badges for what needs attention; sections with sub-pages open out (e.g. Work orders: Open · Assigned to me · Calendar · Completed), and the same pages are tabs on the page. **Favorites** (star any page, filters included) and **Recently** (the records you opened) sit at the top. The top bar has a breadcrumb, **search** (⌘K / Ctrl K), **+ New** (work order, request, asset or part) and the bell. Each page has one main button; exports, imports and printing are under **More**. The sidebar can be hidden for more room; a slide-out menu on phones. |
| **Dashboard** | Tiles for overdue, due this week, assigned to you and completed in 30 days (vs the 30 days before); a weekly chart of work opened vs completed (or the open backlog) with a hover readout and a table view; open work by equipment; downtime by equipment (30 days); PM compliance (90 days); and what needs attention, requests to review and low stock. |
| **Activity panel** | On wide screens, a right-hand panel with your latest notifications, what the team did lately (work completed and opened, problems reported, equipment marked down) and the team. Hide or show it with the panel button in the top bar. |
| **Search** | One box for work orders, equipment, parts and requests — by name, description, asset tag, serial or part number, or a number like WO-0012. |
| **Onboarding** | On their first visit, people get a short welcome for their role — how work flows from PM schedules and requests to completed work, how to read the screen, how to do the main job — then a guided tour that points at the real screen. It comes back when someone's role changes (a requester made a technician gets the technician's tour). The dashboard has a getting-started card: an admin's **setup checklist** that ticks itself off (locations, equipment, PM schedules, team, parts, a first completed work order), *how to do a work order* for technicians, *how reporting works* for requesters. Admins are told when someone new signs in, and People marks them **New**. |
| **Help & guide** | The **?** in the top bar: how everything works, written for your role, with **Take the tour** to replay the tour. |
| **Locations** | A tree (plant → area → line). Each location shows the equipment in it and below it, and its open work orders. Existing free-text locations were converted automatically. |
| **Equipment tree** | Assets can sit under a parent (a dryer under its compressor). The asset list shows the tree, filters by location (including sub-locations) and by "down now". |
| **Asset page** | Tabs: Overview (details, meter, sub-assets, open work) · Work orders · PM schedules · Downtime · Meter readings. |
| **Downtime** | Mark an asset down / back up, tick "asset is down" on a new repair or request, and mark it back up when completing the work order. Totals for 7 / 30 / 90 days and a downtime log. Down assets show on the dashboard. |
| **Requests** | Anyone can **Report a problem** (what's wrong, which equipment, how urgent, is it down). A reviewer approves it into a work order or rejects it with a reason. |
| **Roles** | **Admin** (set-up, reviewing requests, people), **Technician** (does and records the work), **Requester** (reports problems, follows their own requests). The first person to sign in becomes admin; new people start as requesters, and admins are told they've joined. Manage roles on the **People** page. |
| **Parts & stock** | Parts list with on-hand quantity, low-stock level, cost and bin location. Restock and count corrections, a full stock history, low-stock badges and a dashboard card. Parts used on a work order come out of stock (and go back if removed). |
| **Labor time** | Start / stop timer on a work order (several people can be on the clock), or log time afterwards. Totals on the work order and in reports. |
| **Photos & files** | Attach photos and PDFs to work orders and assets (manuals, nameplates). Phone photos are shrunk before uploading. |
| **Printable records** | A printable work order record (checklist, parts, time, photos, sign-off lines) and an asset's maintenance history for any date range — print or save as PDF for audits. |
| **Checklist templates** | Write a checklist once (e.g. *Forklift pre-shift inspection*) and pick it on any number of PM schedules. Changing the template updates every PM that follows it, and their work orders that haven't been started. Start a template from scratch or from an existing PM's checklist. PM schedules › **Checklists** (admins). |
| **CSV import** | Bulk-load or bulk-edit **assets** and **parts** from Excel: export, edit, import. A preview shows what each row will do (new / update / skipped with the reason) before anything changes. Assets match by tag, parts by part number; missing locations are created; parents can be in the same file. |
| **Notifications** | A bell in the top bar with an unread count (the latest also show in the activity panel). You're told when a work order is assigned to you or a PM work order is created for you, when your request is approved, rejected or done, and — for admins — about new requests, follow-up repairs and parts going low or out of stock. |
| **Reports** | Pick a date range (30 / 90 days, 12 months, this year, or custom). KPIs: **PM compliance** (done by the due date), work orders done / open / overdue, **downtime**, **MTTR / MTBF**, and **maintenance cost** (parts, plus labor at an hourly rate you enter). Charts of work done by type, compliance over time, downtime and cost by asset, and a per-asset table with CSV export. |
| **QR labels** | Print 2″ × 4″ labels (Avery 5163) for one asset, a location or all equipment. Scanning opens the asset for staff, and **Report a problem** with the asset filled in for everyone else (after sign-in if needed). |
| **Daily email** | Each weekday morning, techs and admins get their overdue / due-soon work orders, and admins a plant summary. Needs email set up (hosted only); preview it on the People page. |
| **Sign-in** | Email magic link, restricted to `ALLOWED_EMAIL_DOMAINS` (default `as-plastech.com`). In local mode, sign-in skips the email step. Until email works, a shared **team password** can be used instead (below). |

The due-date rules ([`lib/schedule.ts`](lib/schedule.ts)), work order due status
([`lib/work-orders.ts`](lib/work-orders.ts)) and checklist handling
([`lib/checklist.ts`](lib/checklist.ts)) are pure functions with unit tests next to them.

## Run it on your computer (no Vercel needed)

All you need is **Node.js**. The database runs on your computer, and there's no
account, email service or cloud setup.

1. Install **Node.js LTS** from [nodejs.org](https://nodejs.org) (accept the defaults).
2. Unzip this folder somewhere permanent, e.g. `Documents\pm-system`.
3. Start it:
   - **Windows:** double-click **`Start PM System.cmd`**.
   - **Mac / anything else:** open a terminal in the folder and run `npm run local`.
4. The first start takes a few minutes: it installs dependencies, creates the
   database and builds the app. Later starts take about 10 seconds. Your browser
   opens **http://localhost:3000** when it's ready.
5. Sign in with your company email. In local mode there's no email check, so
   you're signed in right away.
   The first person to sign in becomes the **admin**; everyone after starts as a
   **requester** until an admin makes them a technician on the **People** page.
6. On the empty dashboard, click **Load sample equipment** to try it out, or
   **Add asset** to start entering real equipment.

**Keep the window open** while you use it. Close it (or press Ctrl+C) to stop.

Other devices on the same network (a phone scanning a QR label, a tablet on the
floor) can use the **network address** the window shows, e.g. `http://192.168.1.20:3000`.
Print QR labels from that address so the codes point somewhere phones can reach.

| Command | What it does |
|---------|--------------|
| `npm run local` | Start the app (and the database). |
| `npm run local:stop` | Stop the background database. The app stops when you close its window. |
| `npm run local:reset` | **Delete all local data** and start over (asks you to type `DELETE`). |

**Where the data lives:** in Prisma's local database folder in your user profile.
On Windows that's `%LOCALAPPDATA%\prisma-dev-nodejs`, and on a Mac
`~/Library/Application Support/prisma-dev-nodejs`. The data survives restarts and
replacing the app folder with a newer version. It is **not backed up**, so treat
local mode as a trial or a stopgap.

**Letting coworkers use it:** while it's running, anyone on the same network can open
`http://<this computer's IP>:3000`. The startup output shows the address as
"Network". Windows may ask whether to let Node.js through the firewall; allow it
on private networks. Keep in mind that local mode doesn't verify emails, so anyone
who can reach the page can sign in as any company address. The computer has to
stay on and awake for others to use it.

## Deploy to Vercel (first time)

1. **Import the repo:** Vercel → *Add New… → Project* → pick this repo. The framework
   is detected as Next.js; leave the defaults.
2. **Add the database:** in the project, go to *Storage → Create Database → Neon*
   (Marketplace) and connect it to the project, ticking **Production** and
   **Preview**. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.
   Prisma Postgres (also under *Storage*) works too: the build finds whichever
   connection variables your database sets.
3. **Set up email (Resend):**
   - Create an account at [resend.com](https://resend.com), add and verify the
     `as-plastech.com` domain (DNS records), and create an API key.
   - Until the domain is verified, Resend only delivers to your own account email.
4. **Add environment variables** (*Settings → Environment Variables*):

   | Name | Value |
   |------|-------|
   | `AUTH_SECRET` | output of `npx auth secret` or `openssl rand -base64 32` |
   | `AUTH_RESEND_KEY` | your Resend API key |
   | `EMAIL_FROM` | e.g. `PM System <pm@as-plastech.com>` (must be on the verified domain) |
   | `ALLOWED_EMAIL_DOMAINS` | `as-plastech.com` (comma-separate to allow more) |
   | `CRON_SECRET` | any long random string — protects the daily email job (Vercel sends it automatically) |
   | `APP_URL` | the site's address, e.g. `https://pm.as-plastech.com` (used for links in emails and QR labels) |
   | `ORG_NAME` | optional — company name on printed records and labels (default "A.S. Plastech") |
   | `LABOR_RATE` | optional — default labor cost per hour for reports (can be changed on the page) |

5. **Deploy.** The `vercel-build` script ([`scripts/vercel-build.ts`](scripts/vercel-build.ts))
   checks these settings first, then runs `prisma migrate deploy` (so the tables are
   created on the first deploy) and builds the app. If a required setting is
   missing, the build log lists what to add, under *PM System — checking settings*.
   After changing environment variables, redeploy (*Deployments → ⋯ → Redeploy*):
   Vercel only reads them when it builds.
6. Open the site, sign in with your company email, and add your first asset.

### Team password instead of email sign-in

While sign-in email isn't working (for example, before your domain is verified in
Resend), set `TEAM_PASSWORD` in Vercel and redeploy. There's then no sign-in page or
email: the browser asks for a **username** (your work email) and **password** (the
team password), and remembers them. Everyone still has their own account — the first
person in becomes the admin, others start as requesters — so roles and "assigned to
me" keep working.

- Use at least 12 characters, e.g. a few words: `belts-and-bearings-friday`.
- Anyone with the password can sign in as any company address, so keep it to the team.
- There's no "Sign out": to switch person, close all browser windows (or use a private window).
- To go back to email sign-in, delete `TEAM_PASSWORD` and redeploy.

On an empty database the dashboard offers **Load sample equipment** (compressor,
forklift, HVAC, extinguishers) so you can try it out before entering real assets.

## Local development

Run `npm run local` once. It creates `.env` and starts the local database, and
the database keeps running in the background after you stop the app. Then:

```bash
npm run dev                 # http://localhost:3000, with hot reload
npm test                    # scheduling unit tests
npm run lint                # typecheck
```

After changing `prisma/schema.prisma`, run `npm run local:migrate -- --name <change>`
(or `npx prisma migrate dev --name <change>` against a regular Postgres) and commit
the new folder in `prisma/migrations/`.

## Project layout

```
app/
  login/                  magic-link sign-in + "check your email"
  (app)/                  everything behind sign-in
    page.tsx              dashboard: KPI tiles, trend and equipment charts, what needs attention
    work-orders/          list, new, [id] detail + complete, [id]/edit, calendar
    pm/                   all PM schedules
    assets/               list, new, [id] detail, edit, add PM schedule
    tasks/[id]/edit       edit a PM schedule
    history/              completed work orders
    reports/              KPIs, charts and per-asset table (+ CSV export)
    checklists/           checklist templates
    notifications/        the bell's list ([id] opens one and marks it read)
    search/               one search across work orders, equipment, parts and requests
    help/                 the Help & guide page (role-aware; replays the tour)
    assets/import, parts/import   CSV import with preview
  a/[id]                  where QR labels point (asset for staff, report a problem for others)
  print/                  printable work orders, asset history, QR labels
auth.ts                   Auth.js config + requireUser() / currentUser() (email link or team password)
proxy.ts                  asks for the team password on every page while TEAM_PASSWORD is set
lib/schedule.ts           PM due-date rules (pure, tested)
lib/work-orders.ts        PM → work order generation, work order due status
lib/checklist.ts          typed checklist items, reading limits, answers (pure, tested)
lib/reports.ts            PM compliance, MTTR / MTBF, date ranges (pure, tested)
lib/csv-import.ts         CSV parsing and import planning (pure, tested); import-run.ts applies it
lib/notify.ts             in-app notifications
lib/actions.ts            server actions (all writes)
lib/queries.ts            shared reads (open work orders, PM schedules, users, the activity panel)
components/app-shell.tsx  sidebar, top bar and activity panel around every page
components/onboarding.tsx the welcome slides and the guided tour (lib/onboarding.ts: who sees what, setup steps)
lib/forms.ts              zod validation + formatting helpers
prisma/schema.prisma      data model
lib/sample-data.ts        sample equipment ("Load sample equipment" / npm run db:seed)
scripts/local.mjs         `npm run local`: local database + app on this computer
```

## Roadmap

Modeled on the layout of [Atlas CMMS](https://github.com/Grashjs/cmms) (ideas only — no code
is copied; Atlas is AGPL).

1. ~~Work orders as the core, fixed schedules, typed checklists, calendar~~ ✅
2. ~~Plant structure: locations tree, parent/child assets, downtime logging, requests~~ ✅
3. ~~Parts & stock, labor time, photos & files, roles, daily email, printable records~~ ✅
4. ~~Reports (PM compliance, MTBF / MTTR, cost per asset), QR labels on equipment,
   reading limits with follow-up work orders~~ ✅
5. ~~Checklist templates, CSV import of assets and parts, notifications bell~~ ✅

Ideas for later: purchasing (vendors, purchase requests, receiving into stock),
a workload view per technician, on-screen signatures.
