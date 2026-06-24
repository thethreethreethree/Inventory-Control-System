import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { transfers, transferLines } from "../db/schema";
import { postMovement } from "./ledger";

/** Error carrying an HTTP status for the route layer to surface. */
function httpError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

export interface CreateTransferInput {
  orgId: string;
  fromLocationId: string;
  toLocationId: string;
  reasonCode?: string | null;
  issuedByUserId?: string | null;
  lines: { itemId: string; qty: number }[];
}

/**
 * Create a transfer: stock leaves the source immediately (transfer_out) and the
 * transfer is `in_transit`. The destination is NOT credited until the receiver
 * confirms — so in-transit stock sits at neither location, which is the truth.
 */
export async function createTransfer(input: CreateTransferInput) {
  if (input.fromLocationId === input.toLocationId) {
    throw httpError("from and to locations must differ", 400);
  }

  return db.transaction(async (tx) => {
    const [transfer] = await tx
      .insert(transfers)
      .values({
        orgId: input.orgId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        status: "in_transit",
        reasonCode: input.reasonCode ?? null,
        issuedByUserId: input.issuedByUserId ?? null,
      })
      .returning();
    if (!transfer) throw httpError("failed to create transfer", 500);

    for (const line of input.lines) {
      await tx.insert(transferLines).values({
        orgId: input.orgId,
        transferId: transfer.id,
        itemId: line.itemId,
        baseQty: line.qty.toString(),
      });
      await postMovement(tx, {
        orgId: input.orgId,
        itemId: line.itemId,
        locationId: input.fromLocationId,
        signedBaseQty: -line.qty,
        movementType: "transfer_out",
        reasonCode: input.reasonCode ?? "transfer",
        actorUserId: input.issuedByUserId ?? null,
        refType: "transfer",
        refId: transfer.id,
      });
    }
    return transfer;
  });
}

/**
 * Confirm receipt: credit the destination (transfer_in) and mark received.
 * Records who issued (counterparty) and who received (actor) — the handoff.
 */
export async function confirmTransfer(
  orgId: string,
  transferId: string,
  receivedByUserId?: string | null,
) {
  return db.transaction(async (tx) => {
    const [transfer] = await tx
      .select()
      .from(transfers)
      .where(and(eq(transfers.id, transferId), eq(transfers.orgId, orgId)))
      .limit(1);
    if (!transfer) throw httpError("transfer not found", 404);
    if (transfer.status !== "in_transit") {
      throw httpError(`transfer is ${transfer.status}, cannot confirm`, 409);
    }

    const lines = await tx
      .select()
      .from(transferLines)
      .where(eq(transferLines.transferId, transferId));

    for (const line of lines) {
      await postMovement(tx, {
        orgId,
        itemId: line.itemId,
        locationId: transfer.toLocationId,
        signedBaseQty: Number(line.baseQty),
        movementType: "transfer_in",
        reasonCode: transfer.reasonCode ?? "transfer",
        actorUserId: receivedByUserId ?? null,
        counterpartyUserId: transfer.issuedByUserId ?? null,
        refType: "transfer",
        refId: transfer.id,
      });
    }

    const [updated] = await tx
      .update(transfers)
      .set({
        status: "received",
        receivedByUserId: receivedByUserId ?? null,
        receivedAt: new Date(),
      })
      .where(eq(transfers.id, transferId))
      .returning();
    return updated;
  });
}
