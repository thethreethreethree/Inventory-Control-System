import { and, desc, eq } from "drizzle-orm";
import { recordMovementSchema, MOVEMENT_DELTA } from "@ics/shared";
import { db } from "@/server/db/client";
import { movements, items, locations } from "@/server/db/schema";
import { postMovement } from "@/server/services/ledger";
import { depleteFEFO } from "@/server/lib/fefo";
import { route, parseBody, created, query } from "@/server/http";

export const dynamic = "force-dynamic";

// Record a stock movement. `qty` is a positive magnitude; the server derives
// the signed delta from the type, so a caller can't turn an issue into a gain.
export const POST = route({ permission: "movement.create" }, async ({ ctx, req }) => {
  const input = await parseBody(req, recordMovementSchema);
  const actorUserId = input.actorUserId ?? ctx.userId;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : undefined;

  const result = await db.transaction(async (tx) => {
    // Depletions consume earliest-expiry lots first (FEFO); receipts add stock.
    if (MOVEMENT_DELTA[input.movementType] < 0) {
      const allocations = await depleteFEFO(tx, {
        orgId: ctx.orgId,
        itemId: input.itemId,
        locationId: input.locationId,
        qty: input.qty,
        movementType: input.movementType,
        reasonCode: input.reasonCode ?? null,
        actorUserId,
        counterpartyUserId: input.counterpartyUserId ?? null,
        occurredAt,
      });
      return { allocations };
    }
    const movement = await postMovement(tx, {
      orgId: ctx.orgId,
      itemId: input.itemId,
      locationId: input.locationId,
      signedBaseQty: input.qty,
      movementType: input.movementType,
      reasonCode: input.reasonCode ?? null,
      occurredAt,
      actorUserId,
      counterpartyUserId: input.counterpartyUserId ?? null,
    });
    return { movement };
  });
  return created(result);
});

// Ledger view: recent movements, optionally filtered by item/location.
export const GET = route({}, async ({ req }) => {
  const q = query(req);
  const itemId = q.get("itemId");
  const locationId = q.get("locationId");
  const conds = [];
  if (itemId) conds.push(eq(movements.itemId, itemId));
  if (locationId) conds.push(eq(movements.locationId, locationId));
  const limit = Math.min(Number(q.get("limit") ?? 50) || 50, 200);

  return db
    .select({
      id: movements.id,
      seq: movements.seq,
      item: items.name,
      location: locations.name,
      baseQty: movements.baseQty,
      type: movements.movementType,
      reason: movements.reasonCode,
      occurredAt: movements.occurredAt,
    })
    .from(movements)
    .innerJoin(items, eq(items.id, movements.itemId))
    .innerJoin(locations, eq(locations.id, movements.locationId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(movements.seq))
    .limit(limit);
});
