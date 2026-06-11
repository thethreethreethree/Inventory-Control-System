# InvenTrack Solutions

**Control. Track. Optimize.**

Record, track, and audit inventory flow with full accountability. The design discipline is
in [`InventoryControlThinker.md`](InventoryControlThinker.md); the architecture is in
[`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

**Core law:** stock-on-hand is never stored or edited — it is derived from an append-only
ledger of `movements`. Corrections are new compensating movements, never edits.

## Stack

- **DB** — PostgreSQL (via Docker)
- **API** — Fastify + Drizzle ORM (TypeScript)
- **Web** — React + Vite
- **Shared** — units, movement types, roles, Zod schemas (`packages/shared`)
- Monorepo via pnpm workspaces

## Layout

```
apps/api      Fastify API + Drizzle schema (foundation + ledger)
apps/web      React + Vite web app
packages/shared  Types & validation shared by api + web
db (docker)   PostgreSQL
docs/         SYSTEM_DESIGN.md
```

## Quick start

Prereqs: Node 20+, pnpm, Docker Desktop.

```bash
pnpm install          # install all workspaces
pnpm db:up            # start PostgreSQL in Docker
pnpm db:generate      # generate SQL migrations from the Drizzle schema
pnpm db:migrate       # apply migrations
pnpm db:import        # load Hub & Sky Bar inventory + team accounts/roles
pnpm dev              # run api (:4000) + web (:5173) together
```

Or, after `pnpm db:up` is running, the one-shot:

```bash
pnpm setup            # install + db:up + generate + migrate + import + team
```

Then open http://localhost:5173 — the dashboard shows on-hand balances **derived from the
ledger** plus the item master.

Login: `maria.anna@hubsky.local` / `maria123` (Admin). Staff (Nikko/Jason) may only enter
inventory counts.

## Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | API + web together |
| `pnpm dev:api` / `pnpm dev:web` | one at a time |
| `pnpm db:up` / `pnpm db:down` | start / stop Postgres |
| `pnpm db:generate` | regenerate migrations after a schema change |
| `pnpm db:migrate` | apply migrations |
| `pnpm db:import` / `pnpm db:team` | load inventory + team / re-sync team |
| `pnpm typecheck` | typecheck all workspaces |

## API endpoints (current scaffold)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API + DB liveness |
| POST | `/auth/login` | stub login (real JWT/permissions later) |
| GET | `/items` | item master list |
| GET | `/balances` | **on-hand derived from `SUM(movements)`** |

## Roadmap

See `docs/SYSTEM_DESIGN.md` §8. Next phases: issues/transfers with balance updates →
purchasing (PO→GRN→Invoice) → counts & reconciliation → recipes & sales ingestion →
reporting → POS integration + PWA/offline counts.
