import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Scripts run with cwd = apps/api; also load the repo-root .env so a single
// .env at the project root configures everything.
config();
const here = dirname(fileURLToPath(import.meta.url)); // apps/api/src
config({ path: resolve(here, "../../../.env") }); // repo root

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  DATABASE_URL: required(
    "DATABASE_URL",
    "postgresql://ics:ics_dev_password@localhost:5432/ics",
  ),
  API_PORT: Number(process.env.API_PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
