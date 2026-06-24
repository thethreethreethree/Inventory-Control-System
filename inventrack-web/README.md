# InvenTrack Solutions — Web (Next.js full‑stack)

Ledger‑based inventory control for food & beverage — **Control. Track. Optimize.**
This is the single‑deployable Next.js version of InvenTrack: the same UI and the
same business logic as the original, rebuilt so the **frontend, the API, and the
database all run as one app on Vercel**.

- **Frontend** — React 18 (App Router, client‑rendered dashboard), the click‑to‑learn
  tutorial (English + Tagalog), the on‑page calculator, and the OCR receipt scanner.
- **API** — Next.js Route Handlers under `src/app/api/*` (the old Fastify routes),
  wrapped by `src/server/http.ts` for auth, permissions and an append‑only audit log.
- **Database** — PostgreSQL via Drizzle ORM. Stock‑on‑hand is **derived from an
  immutable movement ledger**, never stored as an editable number.

---

## 1. Prerequisites

- Node.js 18.18+ (20+ recommended)
- A PostgreSQL database. For production the easiest is **Neon** or **Vercel Postgres**
  (both have a free tier). For local dev, any local Postgres works.

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

```env
# Use the POOLED connection string in production (Neon/Vercel give you one).
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
# Long random string. Generate one:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
AUTH_SECRET="change-me-to-a-long-random-string"
```

## 3. Create the schema and seed it

```bash
npm install
npm run db:push     # create all tables from the schema (recommended for a fresh DB)
npm run db:seed     # org, units, permissions, roles, the team, and the 3 locations
```

`db:push` syncs the Drizzle schema straight to the database. (Versioned SQL
migrations also live in `drizzle/` if you prefer `npm run db:migrate`.)

The seed creates these sign‑in accounts (default password **`inventrack123`** — change
it in **Settings → My account**):

| Name        | Email                    | Role  |
|-------------|--------------------------|-------|
| Maria Anna  | maria@hubandsky.local    | Admin |
| Bredily     | bredily@hubandsky.local  | Admin |
| Remy        | remy@hubandsky.local     | Admin |
| Malou       | malou@hubandsky.local    | Admin |
| Nikko       | nikko@hubandsky.local    | Staff |
| Jason       | jason@hubandsky.local    | Staff |

Staff may only enter inventory counts; Admins manage everything. Add your products
under **Items**, or import your catalogue once you're in.

## 4. Run locally

```bash
npm run dev      # http://localhost:3000
```

---

## 5. Deploy to Vercel (fully functional)

1. **Provision a database.** In Neon (or Vercel → Storage → Postgres) create a DB and
   copy its **pooled** connection string.
2. **Push this folder to a GitHub repo**, then in Vercel: *New Project → Import* it.
   Next.js is detected automatically — no build config needed.
3. **Set the Environment Variables** in the Vercel project (Production + Preview):
   - `DATABASE_URL` → your pooled Postgres URL
   - `AUTH_SECRET` → a long random string
4. **Create the schema + seed**, pointing at the production DB. The simplest way is to
   run it once from your machine with the production URL:
   ```bash
   # .env.local temporarily pointed at the production DATABASE_URL
   npm run db:push
   npm run db:seed
   ```
5. **Deploy.** Vercel builds and hosts the whole app — pages and `/api/*` together.

> Why a database is required: "full web functionality" (real, persisted, multi‑user
> data) needs a real database. Vercel runs the app and the API, but it does not host
> Postgres for you — that's the one external piece you provision (steps 1 & 3). Once
> `DATABASE_URL` + `AUTH_SECRET` are set, everything works end to end.

---

## Project layout

```
src/
  app/
    layout.tsx, providers.tsx      # root + client gate (login + shell + learn mode)
    page.tsx, items/page.tsx, …     # the dashboard routes (render src/views/*)
    api/**/route.ts                 # the API (auth, items, movements, counts, …)
    globals.css                     # styles + official brand palette
  views/                            # the page components (Dashboard, Items, …)
  components/                       # AppShell, ui kit, Brand, Login, Calculator, ReceiptScanner
  lib/                              # client hooks/providers (auth, learn mode, useAsync)
  api/                              # typed fetch client (client.ts) + DTO types
  server/
    db/        # schema.ts, client.ts (serverless Postgres), migrate.ts, seed.ts
    services/  # business logic (ledger, transfers, counts, purchasing, reports, …)
    lib/       # units, fefo, token, password, errors, context
    http.ts    # auth + permission + audit + error wrapper for route handlers
  shared/                           # zod schemas, roles/permissions, units, movement types
drizzle/                            # SQL migrations
public/brand/                       # official InvenTrack logos + favicons
```

## Notes

- **Receipt images** are stored in the database (Vercel has no writable disk) and served
  back via a capability URL at `GET /api/attachments/:id`.
- **Learning mode** is the click‑to‑learn tutorial — toggle it in **Settings**, switch
  EN/Tagalog in the banner. Every explanation is written for someone with no prior
  accounting/auditing experience.
- The on‑hand figures are always the running SUM of the ledger; `stock_balances` is only
  a rebuildable cache (**Dashboard → Rebuild cache from ledger** proves it).
