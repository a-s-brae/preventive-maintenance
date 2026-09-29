# PM System

Preventive maintenance tracking for A.S. Plastech. It tracks equipment, runs recurring PM
schedules (by calendar, by usage, or both), gives techs checklists to complete, and
keeps a full work history.

**Stack:** Next.js 16 (App Router, server actions) · Prisma 6 · Neon Postgres ·
Auth.js v5 email magic links (via Resend) · Tailwind CSS 4 · hosted on Vercel.

## What it does

| Area | Details |
|------|---------|
| **Assets** | Name, tag, category, location, make/model/serial, status (active / inactive / retired), optional meter (hours, cycles, miles…). |
| **PM tasks** | Each asset can have many. Interval by **calendar** (every N days/weeks/months/years), **usage** (every N meter units), or **both**. With both, the task is due at whichever comes first. Each task has a checklist, instructions and an estimated time. |
| **Due status** | **Overdue**, **Due soon**, or **OK**. "Due soon" starts N days before the calendar date (capped at ¼ of the interval) or in the last 10% of the usage interval. |
| **Completing PM** | The tech ticks the checklist, enters the date, meter reading and notes. The schedule then resets from that date and reading. |
| **Meter readings** | Log a reading any time. Readings can't go backwards. |
| **Ad-hoc work** | Log repairs and inspections on any asset. They appear in the history but don't affect schedules. |
| **Sign-in** | Email magic link, restricted to `ALLOWED_EMAIL_DOMAINS` (default `as-plastech.com`). |

The due-date rules live in [`lib/schedule.ts`](lib/schedule.ts) as pure functions and are
covered by [`lib/schedule.test.ts`](lib/schedule.test.ts).

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

To load the sample assets (compressor, forklift, HVAC, extinguishers) into an empty
database, run `npm run db:seed` locally against that database.

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL etc. (a Neon dev branch works well)
npx prisma migrate dev      # create tables
npm run db:seed             # optional sample data
npm run dev                 # http://localhost:3000
npm test                    # scheduling unit tests
npm run lint                # typecheck
```

After changing `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` and
commit the new folder in `prisma/migrations/`.

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
prisma/seed.ts            sample data
```

## Planned / easy next steps

- Roles (admin vs. tech vs. read-only) — there's a single role today.
- Email digest of overdue / due-soon PM (Vercel Cron + Resend).
- Photo attachments on work logs (Vercel Blob).
- Parts / inventory used per work order.
- Production equipment: presses and molds work today as assets with meters
  (hours or shots); later, pull shot counts in automatically instead of entering them.
- CSV import of an existing equipment list.
