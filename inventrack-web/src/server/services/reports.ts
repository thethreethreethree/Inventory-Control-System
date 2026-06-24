import { sql } from "drizzle-orm";
import { db } from "../db/client";

function rows(result: unknown) {
  return Array.from(result as Iterable<Record<string, unknown>>);
}

/**
 * Stock valuation. Cost per base unit is a moving average from goods receipts
 * (total received value / total received base qty), so it's unit-agnostic.
 */
export async function valuation(orgId: string) {
  const res = await db.execute(sql`
    WITH cost AS (
      SELECT item_id,
             SUM(qty_received * COALESCE(unit_cost, 0)) AS total_value,
             SUM(received_base_qty) AS total_base
      FROM grn_lines
      WHERE org_id = ${orgId}
      GROUP BY item_id
    )
    SELECT i.sku,
           i.name,
           u.code AS unit,
           COALESCE(SUM(sb.base_qty), 0)::text AS on_hand,
           COALESCE(
             CASE WHEN c.total_base > 0 THEN round(c.total_value / c.total_base, 6) END,
             i.default_cost
           )::text AS avg_cost_per_base,
           CASE
             WHEN c.total_base > 0
               THEN round(COALESCE(SUM(sb.base_qty), 0) * c.total_value / c.total_base, 2)::text
             WHEN i.default_cost IS NOT NULL
               THEN round(COALESCE(SUM(sb.base_qty), 0) * i.default_cost, 2)::text
           END AS value
    FROM items i
    JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN stock_balances sb ON sb.item_id = i.id AND sb.org_id = i.org_id
    LEFT JOIN cost c ON c.item_id = i.id
    WHERE i.org_id = ${orgId}
    GROUP BY i.sku, i.name, u.code, c.total_value, c.total_base, i.default_cost
    ORDER BY
      COALESCE(SUM(sb.base_qty), 0)
      * COALESCE(CASE WHEN c.total_base > 0 THEN c.total_value / c.total_base END, i.default_cost)
      DESC NULLS LAST
  `);
  return rows(res);
}

/** Items at or below their reorder threshold (reorder point, else par level). */
export async function reorder(orgId: string) {
  const res = await db.execute(sql`
    SELECT i.sku,
           i.name,
           u.code AS unit,
           COALESCE(i.reorder_point, i.par_level)::text AS threshold,
           i.reorder_qty::text AS reorder_qty,
           COALESCE(SUM(sb.base_qty), 0)::text AS on_hand
    FROM items i
    JOIN units u ON u.id = i.base_unit_id
    LEFT JOIN stock_balances sb ON sb.item_id = i.id AND sb.org_id = i.org_id
    WHERE i.org_id = ${orgId} AND COALESCE(i.reorder_point, i.par_level) IS NOT NULL
    GROUP BY i.sku, i.name, u.code, i.reorder_point, i.par_level, i.reorder_qty
    HAVING COALESCE(SUM(sb.base_qty), 0) <= COALESCE(i.reorder_point, i.par_level)
    ORDER BY COALESCE(SUM(sb.base_qty), 0) - COALESCE(i.reorder_point, i.par_level) ASC
  `);
  return rows(res);
}

/** Lots with remaining on-hand expiring within `days` (incl. already expired). */
export async function expiry(orgId: string, days: number) {
  const res = await db.execute(sql`
    SELECT i.sku,
           i.name,
           l.lot_no,
           l.expiry_date,
           loc.name AS location,
           COALESCE(SUM(m.base_qty), 0)::text AS qty,
           (l.expiry_date < now()) AS expired
    FROM lots l
    JOIN items i ON i.id = l.item_id
    JOIN locations loc ON loc.id = l.location_id
    LEFT JOIN movements m ON m.lot_id = l.id
    WHERE l.org_id = ${orgId}
      AND l.expiry_date IS NOT NULL
      AND l.expiry_date <= now() + (${days} || ' days')::interval
    GROUP BY i.sku, i.name, l.lot_no, l.expiry_date, loc.name
    HAVING COALESCE(SUM(m.base_qty), 0) > 0
    ORDER BY l.expiry_date ASC
  `);
  return rows(res);
}

/** All lots with remaining on-hand (FEFO order). Proves lot-level tracking. */
export async function lotsOnHand(orgId: string) {
  const res = await db.execute(sql`
    SELECT i.sku,
           i.name,
           l.lot_no,
           l.expiry_date,
           loc.name AS location,
           COALESCE(SUM(m.base_qty), 0)::text AS on_hand,
           (l.expiry_date IS NOT NULL AND l.expiry_date < now()) AS expired
    FROM lots l
    JOIN items i ON i.id = l.item_id
    JOIN locations loc ON loc.id = l.location_id
    LEFT JOIN movements m ON m.lot_id = l.id
    WHERE l.org_id = ${orgId}
    GROUP BY i.sku, i.name, l.lot_no, l.expiry_date, loc.name
    HAVING COALESCE(SUM(m.base_qty), 0) > 0
    ORDER BY l.expiry_date ASC NULLS LAST
  `);
  return rows(res);
}

/** Movement activity (counts + net base qty) by type within a date range. */
export async function activity(orgId: string, fromISO: string, toISO: string) {
  const res = await db.execute(sql`
    SELECT movement_type AS type,
           count(*)::int AS movements,
           SUM(base_qty)::text AS net_base
    FROM movements
    WHERE org_id = ${orgId} AND occurred_at >= ${fromISO} AND occurred_at <= ${toISO}
    GROUP BY movement_type
    ORDER BY count(*) DESC
  `);
  return rows(res);
}

/** Posted count variances (theoretical vs actual) — the shrinkage signal. */
export async function variance(orgId: string) {
  const res = await db.execute(sql`
    SELECT i.sku,
           i.name,
           l.name AS location,
           cl.counted_base_qty::text AS counted,
           cl.expected_base_qty::text AS expected,
           cl.variance_base::text AS variance,
           sc.posted_at
    FROM count_lines cl
    JOIN stock_counts sc ON sc.id = cl.count_id
    JOIN items i ON i.id = cl.item_id
    JOIN locations l ON l.id = sc.location_id
    WHERE cl.org_id = ${orgId} AND cl.variance_base IS NOT NULL AND cl.variance_base <> 0
    ORDER BY sc.posted_at DESC NULLS LAST
    LIMIT 100
  `);
  return rows(res);
}
