import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { and } from "drizzle-orm";
import { goodsReceipts, grnLines, poLines, purchaseOrders, lots } from "../db/schema";
import { httpError } from "../lib/errors";
import { resolveUnitId, toBaseQty } from "../lib/units";
import { postMovement } from "./ledger";

const RECEIVABLE_PO_STATUSES = ["approved", "sent", "partially_received"];

type PoStatus = (typeof purchaseOrders.$inferSelect)["status"];

export interface ReceiveGoodsInput {
  orgId: string;
  poId?: string | null;
  supplierId?: string | null;
  locationId: string;
  receivedByUserId?: string | null;
  note?: string | null;
  lines: {
    itemId: string;
    poLineId?: string | null;
    qtyReceived: number;
    unitCode: string;
    unitCost?: number | null;
    lotNo?: string | null;
    expiryDate?: string | null;
    condition?: string | null;
  }[];
}

/**
 * Receive goods at the door (the GRN — what physically ARRIVED). This is the
 * inflow into the ledger: each line posts a `receipt` movement (converted to
 * base units) and advances the linked PO line + PO status. Receiving against a
 * PO requires the PO to be approved first.
 */
export async function receiveGoods(input: ReceiveGoodsInput) {
  let po = null;
  if (input.poId) {
    const [found] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, input.poId), eq(purchaseOrders.orgId, input.orgId)))
      .limit(1);
    if (!found) throw httpError("purchase order not found", 404);
    if (!RECEIVABLE_PO_STATUSES.includes(found.status)) {
      throw httpError(`PO is ${found.status}; approve it before receiving`, 409);
    }
    po = found;
  }

  // Resolve units + base quantities up front (reads, outside the tx).
  const resolved: (ReceiveGoodsInput["lines"][number] & {
    unitId: string;
    receivedBaseQty: number;
  })[] = [];
  for (const line of input.lines) {
    const unitId = await resolveUnitId(input.orgId, line.unitCode);
    const receivedBaseQty = await toBaseQty(input.orgId, line.itemId, unitId, line.qtyReceived);
    resolved.push({ ...line, unitId, receivedBaseQty });
  }

  return db.transaction(async (tx) => {
    const [grn] = await tx
      .insert(goodsReceipts)
      .values({
        orgId: input.orgId,
        poId: input.poId ?? null,
        supplierId: input.supplierId ?? po?.supplierId ?? null,
        locationId: input.locationId,
        receivedByUserId: input.receivedByUserId ?? null,
        note: input.note ?? null,
      })
      .returning();
    if (!grn) throw httpError("failed to create goods receipt", 500);

    for (const line of resolved) {
      await tx.insert(grnLines).values({
        orgId: input.orgId,
        grnId: grn.id,
        poLineId: line.poLineId ?? null,
        itemId: line.itemId,
        qtyReceived: line.qtyReceived.toString(),
        unitId: line.unitId,
        receivedBaseQty: line.receivedBaseQty.toString(),
        unitCost: line.unitCost != null ? line.unitCost.toString() : null,
        lotNo: line.lotNo ?? null,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        condition: line.condition ?? "good",
      });

      // Create a lot when a lot number or expiry is supplied (enables FEFO).
      let lotId: string | null = null;
      if (line.lotNo || line.expiryDate) {
        const [lot] = await tx
          .insert(lots)
          .values({
            orgId: input.orgId,
            itemId: line.itemId,
            locationId: input.locationId,
            lotNo: line.lotNo ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          })
          .returning();
        lotId = lot?.id ?? null;
      }

      await postMovement(tx, {
        orgId: input.orgId,
        itemId: line.itemId,
        locationId: input.locationId,
        signedBaseQty: line.receivedBaseQty,
        movementType: "receipt",
        reasonCode: input.poId ? "po_receipt" : "adhoc_receipt",
        actorUserId: input.receivedByUserId ?? null,
        refType: "grn",
        refId: grn.id,
        unitCost: line.unitCost ?? null,
        lotId,
      });

      if (line.poLineId) {
        await tx.execute(sql`
          UPDATE po_lines
          SET received_base_qty = received_base_qty + ${line.receivedBaseQty}
          WHERE id = ${line.poLineId} AND org_id = ${input.orgId}
        `);
      }
    }

    // Recompute PO status from its lines (fully vs partially received).
    let poStatus: PoStatus | null = null;
    if (po) {
      const lines = await tx.select().from(poLines).where(eq(poLines.poId, po.id));
      const allReceived = lines.every(
        (l) => Number(l.receivedBaseQty) >= Number(l.orderedBaseQty),
      );
      const anyReceived = lines.some((l) => Number(l.receivedBaseQty) > 0);
      poStatus = allReceived
        ? "received"
        : anyReceived
          ? "partially_received"
          : po.status;
      if (poStatus !== po.status) {
        await tx
          .update(purchaseOrders)
          .set({ status: poStatus })
          .where(eq(purchaseOrders.id, po.id));
      }
    }

    return { grnId: grn.id, poStatus };
  });
}
