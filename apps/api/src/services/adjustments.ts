import { and, eq } from "drizzle-orm";
import type { MovementType } from "@ics/shared";
import { db } from "../db/client";
import { adjustments } from "../db/schema";
import { httpError } from "../lib/errors";
import { postMovement, type Tx } from "./ledger";

export interface CreateAdjustmentInput {
  orgId: string;
  itemId: string;
  locationId: string;
  baseQtyDelta: number; // signed: + adds stock, - removes
  reason: string;
  refType?: string | null;
  refId?: string | null;
  requestedByUserId?: string | null;
  note?: string | null;
}

/** Create a PENDING adjustment. Stock is NOT changed until it is approved. */
export async function createAdjustment(tx: Tx, input: CreateAdjustmentInput) {
  const [adjustment] = await tx
    .insert(adjustments)
    .values({
      orgId: input.orgId,
      itemId: input.itemId,
      locationId: input.locationId,
      baseQtyDelta: input.baseQtyDelta.toString(),
      reason: input.reason,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      note: input.note ?? null,
    })
    .returning();
  if (!adjustment) throw httpError("failed to create adjustment", 500);
  return adjustment;
}

/**
 * Approve a pending adjustment: post the compensating movement and mark it
 * approved. Approver must differ from requester (separation of duties) — this
 * is what prevents someone writing off their own variance to hide a gap.
 */
export async function approveAdjustment(
  orgId: string,
  adjustmentId: string,
  reviewedByUserId?: string | null,
) {
  return db.transaction(async (tx) => {
    const [adj] = await tx
      .select()
      .from(adjustments)
      .where(and(eq(adjustments.id, adjustmentId), eq(adjustments.orgId, orgId)))
      .limit(1);
    if (!adj) throw httpError("adjustment not found", 404);
    if (adj.status !== "pending") throw httpError(`adjustment is ${adj.status}`, 409);
    if (reviewedByUserId && adj.requestedByUserId && reviewedByUserId === adj.requestedByUserId) {
      throw httpError("approver must differ from requester (separation of duties)", 403);
    }

    const movementType: MovementType =
      adj.refType === "count" ? "count_correction" : "adjustment";
    const movement = await postMovement(tx, {
      orgId,
      itemId: adj.itemId,
      locationId: adj.locationId,
      signedBaseQty: Number(adj.baseQtyDelta),
      movementType,
      reasonCode: adj.reason,
      actorUserId: reviewedByUserId ?? null,
      counterpartyUserId: adj.requestedByUserId ?? null,
      refType: "adjustment",
      refId: adj.id,
    });

    const [updated] = await tx
      .update(adjustments)
      .set({
        status: "approved",
        reviewedByUserId: reviewedByUserId ?? null,
        reviewedAt: new Date(),
        postedMovementId: movement?.id ?? null,
      })
      .where(eq(adjustments.id, adjustmentId))
      .returning();
    return updated;
  });
}

export async function rejectAdjustment(
  orgId: string,
  adjustmentId: string,
  reviewedByUserId?: string | null,
  note?: string | null,
) {
  return db.transaction(async (tx) => {
    const [adj] = await tx
      .select()
      .from(adjustments)
      .where(and(eq(adjustments.id, adjustmentId), eq(adjustments.orgId, orgId)))
      .limit(1);
    if (!adj) throw httpError("adjustment not found", 404);
    if (adj.status !== "pending") throw httpError(`adjustment is ${adj.status}`, 409);

    const [updated] = await tx
      .update(adjustments)
      .set({
        status: "rejected",
        reviewedByUserId: reviewedByUserId ?? null,
        reviewedAt: new Date(),
        note: note ?? adj.note,
      })
      .where(eq(adjustments.id, adjustmentId))
      .returning();
    return updated;
  });
}
