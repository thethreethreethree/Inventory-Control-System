import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { publicRoute } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = publicRoute(async () => {
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "ok", db: "up" };
  } catch {
    return { status: "ok", db: "down" };
  }
});
