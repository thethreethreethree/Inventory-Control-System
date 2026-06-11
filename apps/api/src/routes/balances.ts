import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { getOrgContext } from "../lib/context";
import { rebuildBalances } from "../services/ledger";

function asRows(result: unknown) {
  return Array.from(result as Iterable<Record<string, unknown>>);
}

export async function balanceRoutes(app: FastifyInstance) {
  /**
   * On-hand DERIVED from the ledger (SUM of movements) — the source of truth.
   * Delete stock_balances and this still returns the correct figures.
   */
  app.get("/", async () => {
    const { orgId } = await getOrgContext();
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
      WHERE m.org_id = ${orgId}
      GROUP BY i.sku, i.name, l.name, u.code
      ORDER BY i.name, l.name
    `);
    return asRows(rows);
  });

  /** The maintained cache (stock_balances). Should always equal `/balances`. */
  app.get("/cache", async () => {
    const { orgId } = await getOrgContext();
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
      WHERE sb.org_id = ${orgId}
      ORDER BY i.name, l.name
    `);
    return asRows(rows);
  });

  /** Rebuild the cache from the ledger (self-heal + proof of derivability). */
  app.post("/rebuild", async () => {
    const { orgId } = await getOrgContext();
    await rebuildBalances(orgId);
    return { rebuilt: true };
  });
}
