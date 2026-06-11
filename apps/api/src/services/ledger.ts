import { sql } from "drizzle-orm";
import type { MovementType } from "@ics/shared";
import { db } from "../db/client";
import { movements } from "../db/schema";

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
}

/**
 * Append exactly one movement AND update the derived balance cache in the SAME
 * transaction, so the ledger and `stock_balances` can never drift apart. The
 * ledger remains the source of truth; the cache is a rebuildable convenience.
 */
export async function postMovement(tx: Tx, input: PostMovementInput) {
  const qty = input.signedBaseQty.toString();

  const [movement] = await tx
    .insert(movements)
    .values({
      orgId: input.orgId,
      itemId: input.itemId,
      locationId: input.locationId,
      baseQty: qty,
      movementType: input.movementType,
      reasonCode: input.reasonCode ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      actorUserId: input.actorUserId ?? null,
      counterpartyUserId: input.counterpartyUserId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
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
