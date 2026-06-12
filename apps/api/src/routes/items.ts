import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createItemSchema } from "@ics/shared";
import { db } from "../db/client";
import { items } from "../db/schema";
import { getCtx } from "../lib/auth";
import { httpError, statusOf } from "../lib/errors";
import { resolveUnitId, toBaseQty } from "../lib/units";

const setCostSchema = z.object({
  cost: z.number().nonnegative(),
  unitCode: z.string().min(1), // unit the cost is quoted in (e.g. "bottle")
});

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
             su.code AS stock_unit,
             i.default_cost::text AS default_cost,
             (SELECT qty_in_base FROM item_pack_levels ipl
                WHERE ipl.item_id = i.id AND ipl.unit_id = i.stock_unit_id LIMIT 1)::text AS stock_unit_base,
             COALESCE(
               (SELECT SUM(sb.base_qty) FROM stock_balances sb WHERE sb.item_id = i.id),
               0
             )::text AS on_hand
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      JOIN units u ON u.id = i.base_unit_id
      LEFT JOIN units su ON su.id = i.stock_unit_id
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

  // Set an item's fallback cost (quoted in any unit; stored per base unit).
  app.put("/:id/cost", async (req, reply) => {
    const parsed = setCostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId } = getCtx(req);
    try {
      const unitId = await resolveUnitId(orgId, parsed.data.unitCode);
      const basePerUnit = await toBaseQty(orgId, id, unitId, 1);
      if (basePerUnit <= 0) throw httpError("invalid unit conversion", 400);
      const costPerBase = parsed.data.cost / basePerUnit;
      await db
        .update(items)
        .set({ defaultCost: String(costPerBase) })
        .where(and(eq(items.id, id), eq(items.orgId, orgId)));
      return { ok: true, costPerBase };
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });
}
