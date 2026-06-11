import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { purchaseOrders, poLines } from "../db/schema";
import { httpError } from "../lib/errors";
import { resolveUnitId, toBaseQty } from "../lib/units";

export interface CreatePOInput {
  orgId: string;
  supplierId: string;
  reference?: string | null;
  expectedAt?: string | null;
  orderedByUserId?: string | null;
  note?: string | null;
  lines: {
    itemId: string;
    qtyOrdered: number;
    unitCode: string;
    unitCost?: number | null;
  }[];
}

/** Create a draft PO (what we ORDERED). Quantities are converted to base units
 * up front so received-vs-ordered status math is unit-agnostic later. */
export async function createPurchaseOrder(input: CreatePOInput) {
  const resolved: (CreatePOInput["lines"][number] & {
    unitId: string;
    orderedBaseQty: number;
  })[] = [];
  for (const line of input.lines) {
    const unitId = await resolveUnitId(input.orgId, line.unitCode);
    const orderedBaseQty = await toBaseQty(input.orgId, line.itemId, unitId, line.qtyOrdered);
    resolved.push({ ...line, unitId, orderedBaseQty });
  }

  return db.transaction(async (tx) => {
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        orgId: input.orgId,
        supplierId: input.supplierId,
        reference: input.reference ?? null,
        status: "draft",
        orderedByUserId: input.orderedByUserId ?? null,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        note: input.note ?? null,
      })
      .returning();
    if (!po) throw httpError("failed to create purchase order", 500);

    for (const line of resolved) {
      await tx.insert(poLines).values({
        orgId: input.orgId,
        poId: po.id,
        itemId: line.itemId,
        qtyOrdered: line.qtyOrdered.toString(),
        unitId: line.unitId,
        unitCost: line.unitCost != null ? line.unitCost.toString() : null,
        orderedBaseQty: line.orderedBaseQty.toString(),
      });
    }
    return po;
  });
}

/**
 * Approve a draft PO. Separation of duties: the approver must differ from the
 * person who created the PO — a single user cannot both order and approve.
 */
export async function approvePurchaseOrder(
  orgId: string,
  poId: string,
  approvedByUserId?: string | null,
) {
  return db.transaction(async (tx) => {
    const [po] = await tx
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.orgId, orgId)))
      .limit(1);
    if (!po) throw httpError("purchase order not found", 404);
    if (po.status !== "draft") {
      throw httpError(`PO is ${po.status}, cannot approve`, 409);
    }
    if (approvedByUserId && po.orderedByUserId && approvedByUserId === po.orderedByUserId) {
      throw httpError(
        "approver must differ from the PO creator (separation of duties)",
        403,
      );
    }

    const [updated] = await tx
      .update(purchaseOrders)
      .set({
        status: "approved",
        approvedByUserId: approvedByUserId ?? null,
        approvedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, poId))
      .returning();
    return updated;
  });
}
