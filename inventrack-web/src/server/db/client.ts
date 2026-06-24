import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Postgres connection for serverless (Vercel) + local dev.
 *
 * The client is cached on globalThis so that hot-reload in dev and warm
 * serverless invocations reuse a single connection instead of opening a new
 * pool every time (which would exhaust a pooled Postgres like Neon). `max: 1`
 * suits short-lived serverless calls; `prepare: false` is required when the
 * connection string points at a transaction-mode pooler (Neon/PgBouncer).
 */
const globalForDb = globalThis as unknown as {
  _icsSql?: ReturnType<typeof postgres>;
};

export const sqlClient =
  globalForDb._icsSql ?? postgres(env.DATABASE_URL, { max: 1, prepare: false });

if (env.NODE_ENV !== "production") globalForDb._icsSql = sqlClient;

export const db = drizzle(sqlClient, { schema });
export type DB = typeof db;
