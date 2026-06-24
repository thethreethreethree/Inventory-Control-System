import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load local env for CLI (drizzle-kit) usage; on Vercel the env is already set.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "" },
});
