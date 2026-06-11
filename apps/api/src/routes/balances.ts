import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

export async function balanceRoutes(app: FastifyInstance) {
  /**
   * On-hand is DERIVED from the ledger (SUM of movements), never read from a
   * stored number. This endpoint is the proof of the core architectural law:
   * delete stock_balances and this still returns the correct figures.
   */
  app.get("/", async () => {
    const rows = await db.execute(sql`
      SELECT i.sku                         AS sku,
             i.name                        AS item,
             l.name                        AS location,
             u.code                        AS unit,
             COALESCE(SUM(m.base_qty), 0)::text AS on_hand
      FROM movements m
      JOIN items i     ON i.id = m.item_id
      JOIN locations l ON l.id = m.location_id
      JOIN units u     ON u.id = i.base_unit_id
      GROUP BY i.sku, i.name, l.name, u.code
      ORDER BY i.name, l.name
    `);
    return Array.from(rows as Iterable<Record<string, unknown>>);
  });
}
