import { sql } from "drizzle-orm";
import type { MovementType } from "@ics/shared";
import { postMovement, type Tx } from "../services/ledger";

export interface DepleteInput {
  orgId: string;
  itemId: string;
  locationId: string;
  qty: number; // positive magnitude in base units
  movementType: MovementType;
  reasonCode?: string | null;
  actorUserId?: string | null;
  counterpartyUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  occurredAt?: Date;
}

export interface Allocation {
  lotId: string | null;
  lotNo: string | null;
  expiry: string | null;
  qty: number;
}

const EPS = 1e-9;

/**
 * Deplete `qty` of an item from a location, consuming the earliest-expiring lot
 * first (FEFO). Posts one movement per lot consumed (tagged with lotId). Any
 * amount not covered by tracked lots posts as an untagged movement, so the
 * ledger still balances even when stock predates lot tracking.
 */
export async function depleteFEFO(tx: Tx, input: DepleteInput): Promise<Allocation[]> {
  const res = await tx.execute(sql`
    SELECT l.id, l.lot_no, l.expiry_date, COALESCE(SUM(m.base_qty), 0) AS on_hand
    FROM lots l
    LEFT JOIN movements m ON m.lot_id = l.id
    WHERE l.org_id = ${input.orgId}
      AND l.item_id = ${input.itemId}
      AND l.location_id = ${input.locationId}
    GROUP BY l.id, l.lot_no, l.expiry_date
    HAVING COALESCE(SUM(m.base_qty), 0) > 0
    ORDER BY l.expiry_date ASC NULLS LAST, l.created_at ASC
  `);
  const lots = Array.from(
    res as Iterable<{ id: string; lot_no: string | null; expiry_date: string | null; on_hand: string }>,
  );

  const base = {
    orgId: input.orgId,
    itemId: input.itemId,
    locationId: input.locationId,
    movementType: input.movementType,
    reasonCode: input.reasonCode ?? null,
    actorUserId: input.actorUserId ?? null,
    counterpartyUserId: input.counterpartyUserId ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    occurredAt: input.occurredAt,
  };

  const allocations: Allocation[] = [];
  let remaining = input.qty;

  for (const lot of lots) {
    if (remaining <= EPS) break;
    const take = Math.min(Number(lot.on_hand), remaining);
    if (take <= EPS) continue;
    await postMovement(tx, { ...base, signedBaseQty: -take, lotId: lot.id });
    allocations.push({ lotId: lot.id, lotNo: lot.lot_no, expiry: lot.expiry_date, qty: take });
    remaining -= take;
  }

  if (remaining > EPS) {
    await postMovement(tx, { ...base, signedBaseQty: -remaining });
    allocations.push({ lotId: null, lotNo: null, expiry: null, qty: remaining });
  }

  return allocations;
}
