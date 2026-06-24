import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

function asRows(result: unknown) {
  return Array.from(result as Iterable<Record<string, unknown>>);
}

/** The maintained cache (stock_balances). Should always equal `/balances`. */
export const GET = route({}, async ({ ctx }) => {
  const rows = await db.execute(sql`
    SELECT i.sku            AS sku,
           i.name           AS item,
           l.name           AS location,
           u.code           AS unit,
           sb.base_qty::text AS on_hand
    FROM stock_balances sb
    JOIN items i     ON i.id = sb.item_id
    JOIN locations l ON l.id = sb.location_id
    JOIN units u     ON u.id = i.base_unit_id
    WHERE sb.org_id = ${ctx.orgId}
    ORDER BY i.name, l.name
  `);
  return asRows(rows);
});
