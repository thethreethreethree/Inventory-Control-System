import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { createItemSchema } from "@ics/shared";
import { db } from "../db/client";
import { items } from "../db/schema";
import { getCtx } from "../lib/auth";
import { statusOf } from "../lib/errors";
import { resolveUnitId } from "../lib/units";

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

  // Create a new item (admin item-master management).
  app.post("/", async (req, reply) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = getCtx(req);
    try {
      const baseUnitId = await resolveUnitId(orgId, parsed.data.baseUnitCode);
      const [item] = await db
        .insert(items)
        .values({
          orgId,
          sku: parsed.data.sku,
          name: parsed.data.name,
          itemType: parsed.data.itemType as never,
          baseUnitId,
          brand: parsed.data.brand ?? null,
          barcode: parsed.data.barcode ?? null,
          categoryId: parsed.data.categoryId ?? null,
        })
        .returning();
      return reply.code(201).send(item);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });
}
