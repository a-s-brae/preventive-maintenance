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
| **Assets** | Name, tag, category, location, make/model/serial, status (active / inactive / retired), optional meter (hours, cycles, miles…). |
| **PM tasks** | Each asset can have many. Interval by **calendar** (every N days/weeks/months/years), **usage** (every N meter units), or **both**. With both, the task is due at whichever comes first. Each task has a checklist, instructions and an estimated time. |
| **Due status** | **Overdue**, **Due soon**, or **OK**. "Due soon" starts N days before the calendar date (capped at ¼ of the interval) or in the last 10% of the usage interval. |
| **Completing PM** | The tech ticks the checklist, enters the date, meter reading and notes. The schedule then resets from that date and reading. |
| **Meter readings** | Log a reading any time. Readings can't go backwards. |
| **Ad-hoc work** | Log repairs and inspections on any asset. They appear in the history but don't affect schedules. |
| **Sign-in** | Email magic link, restricted to `ALLOWED_EMAIL_DOMAINS` (default `as-plastech.com`). In local mode, sign-in skips the email step. |

The due-date rules live in [`lib/schedule.ts`](lib/schedule.ts) as pure functions and are
covered by [`lib/schedule.test.ts`](lib/schedule.test.ts).

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
6. On the empty dashboard, click **Load sample equipment** to try it out, or
   **Add asset** to start entering real equipment.

**Keep the window open** while you use it. Close it (or press Ctrl+C) to stop.

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
   (Marketplace) and connect it to the project. This sets `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` automatically.
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

5. **Deploy.** The `vercel-build` script runs `prisma migrate deploy`, so the tables
   are created on the first deploy.
6. Open the site, sign in with your company email, and add your first asset.

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
    page.tsx              dashboard: overdue / due soon
    assets/               list, new, [id] detail, edit, add task, log work
    tasks/[id]/           edit, complete
    history/              all work logs
auth.ts                   Auth.js config + domain allow-list + requireUser()
lib/schedule.ts           due-date rules (pure, tested)
lib/actions.ts            server actions (all writes)
lib/forms.ts              zod validation + formatting helpers
prisma/schema.prisma      data model
lib/sample-data.ts        sample equipment ("Load sample equipment" / npm run db:seed)
scripts/local.mjs         `npm run local`: local database + app on this computer
```

## Planned / easy next steps

- Roles (admin vs. tech vs. read-only) — there's a single role today.
- Email digest of overdue / due-soon PM (Vercel Cron + Resend).
- Photo attachments on work logs (Vercel Blob).
- Parts / inventory used per work order.
- Production equipment: presses and molds work today as assets with meters
  (hours or shots); later, pull shot counts in automatically instead of entering them.
- CSV import of an existing equipment list.
