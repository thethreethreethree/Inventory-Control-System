import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

function asRows(result: unknown) {
  return Array.from(result as Iterable<Record<string, unknown>>);
}

/**
 * On-hand DERIVED from the ledger (SUM of movements) — the source of truth.
 * Delete stock_balances and this still returns the correct figures.
 */
export const GET = route({}, async ({ ctx }) => {
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
    WHERE m.org_id = ${ctx.orgId}
    GROUP BY i.sku, i.name, l.name, u.code
    ORDER BY i.name, l.name
  `);
  return asRows(rows);
});
