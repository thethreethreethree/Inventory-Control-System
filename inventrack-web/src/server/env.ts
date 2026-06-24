/**
 * Server environment. In Next.js the platform loads .env automatically, so we
 * just read process.env. DATABASE_URL must be a Postgres connection string
 * (Neon / Vercel Postgres in production); AUTH_SECRET signs session tokens.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  // Accept either DATABASE_URL or Vercel Postgres's auto-injected POSTGRES_URL,
  // so adding a Vercel Postgres store needs no manual DB env var.
  DATABASE_URL: required(
    "DATABASE_URL",
    process.env.POSTGRES_URL ?? "postgresql://ics:ics_dev_password@localhost:5432/ics",
  ),
  AUTH_SECRET: required("AUTH_SECRET", "dev-only-change-me-secret"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
