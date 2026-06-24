import { sql } from "drizzle-orm";
import { createItemSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";
import { resolveUnitId } from "@/server/lib/units";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
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
    WHERE i.org_id = ${ctx.orgId}
    ORDER BY i.name
  `);
  return Array.from(rows as Iterable<Record<string, unknown>>);
});

// Create a new item (admin item-master management).
export const POST = route({ permission: "item.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createItemSchema);
  const baseUnitId = await resolveUnitId(ctx.orgId, data.baseUnitCode);
  const [item] = await db
    .insert(items)
    .values({
      orgId: ctx.orgId,
      sku: data.sku,
      name: data.name,
      itemType: data.itemType as never,
      baseUnitId,
      brand: data.brand ?? null,
      barcode: data.barcode ?? null,
      categoryId: data.categoryId ?? null,
    })
    .returning();
  return created(item);
});
