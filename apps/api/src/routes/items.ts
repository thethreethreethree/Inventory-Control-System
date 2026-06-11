import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { getCtx } from "../lib/auth";

export async function itemRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const { orgId } = getCtx(req);
    const rows = await db.execute(sql`
      SELECT i.id,
             i.sku,
             i.name,
             i.brand,
             i.item_type AS "itemType",
             i.status,
             c.name AS category,
             u.code AS unit,
             COALESCE(
               (SELECT SUM(sb.base_qty) FROM stock_balances sb WHERE sb.item_id = i.id),
               0
             )::text AS on_hand
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      JOIN units u ON u.id = i.base_unit_id
      WHERE i.org_id = ${orgId}
      ORDER BY i.name
    `);
    return Array.from(rows as Iterable<Record<string, unknown>>);
  });
}
