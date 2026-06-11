import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { MovementType } from "@ics/shared";
import { db } from "../db/client";
import { movements, periods } from "../db/schema";
import { httpError } from "../lib/errors";

/** A transaction handle (extracted from db.transaction's callback). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PostMovementInput {
  orgId: string;
  itemId: string;
  locationId: string;
  /** Signed delta in base units (e.g. -3750 for an issue of 3750 ml). */
  signedBaseQty: number;
  movementType: MovementType;
  reasonCode?: string | null;
  occurredAt?: Date;
  actorUserId?: string | null;
  counterpartyUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  unitCost?: number | null;
  lotId?: string | null;
}

/**
 * Append exactly one movement AND update the derived balance cache in the SAME
 * transaction, so the ledger and `stock_balances` can never drift apart. The
 * ledger remains the source of truth; the cache is a rebuildable convenience.
 */
export async function postMovement(tx: Tx, input: PostMovementInput) {
  const qty = input.signedBaseQty.toString();
  const occurredAt = input.occurredAt ?? new Date();

  // A movement dated inside a locked period is forbidden — no backdating into
  // a closed/audited period. Applies to every movement type (issue, transfer,
  // receipt, adjustment) since they all flow through here.
  const locked = await tx
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.orgId, input.orgId),
        eq(periods.status, "locked"),
        lte(periods.startsAt, occurredAt),
        gte(periods.endsAt, occurredAt),
      ),
    )
    .limit(1);
  if (locked.length > 0) {
    throw httpError("period is locked; cannot post a movement dated within it", 409);
  }

  const [movement] = await tx
    .insert(movements)
    .values({
      orgId: input.orgId,
      itemId: input.itemId,
      locationId: input.locationId,
      baseQty: qty,
      movementType: input.movementType,
      reasonCode: input.reasonCode ?? null,
      occurredAt,
      actorUserId: input.actorUserId ?? null,
      counterpartyUserId: input.counterpartyUserId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      unitCost: input.unitCost != null ? input.unitCost.toString() : null,
      lotId: input.lotId ?? null,
    })
    .returning();

  await tx.execute(sql`
    INSERT INTO stock_balances (org_id, item_id, location_id, base_qty, updated_at)
    VALUES (${input.orgId}, ${input.itemId}, ${input.locationId}, ${qty}, now())
    ON CONFLICT (org_id, item_id, location_id)
    DO UPDATE SET base_qty = stock_balances.base_qty + ${qty}, updated_at = now()
  `);

  return movement;
}

/**
 * Rebuild the entire balance cache for an org from the ledger. Proves the cache
 * is fully derivable (the core accountability guarantee) and self-heals drift.
 */
/** Theoretical on-hand for one (item, location), straight from the ledger. */
export async function getLedgerBalance(
  orgId: string,
  itemId: string,
  locationId: string,
): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(base_qty), 0)::text AS qty
    FROM movements
    WHERE org_id = ${orgId} AND item_id = ${itemId} AND location_id = ${locationId}
  `);
  const arr = Array.from(rows as Iterable<{ qty: string }>);
  return Number(arr[0]?.qty ?? 0);
}

export async function rebuildBalances(orgId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM stock_balances WHERE org_id = ${orgId}`);
    await tx.execute(sql`
      INSERT INTO stock_balances (org_id, item_id, location_id, base_qty, updated_at)
      SELECT org_id, item_id, location_id, SUM(base_qty), now()
      FROM movements
      WHERE org_id = ${orgId}
      GROUP BY org_id, item_id, location_id
    `);
  });
}
