import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    let dbUp = false;
    try {
      await db.execute(sql`select 1`);
      dbUp = true;
    } catch {
      dbUp = false;
    }
    return { status: "ok", db: dbUp ? "up" : "down", time: new Date().toISOString() };
  });
}
