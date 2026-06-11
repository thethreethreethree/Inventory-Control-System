import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { supplierInvoices, poLines, grnLines, goodsReceipts } from "../db/schema";
import { httpError } from "../lib/errors";

export interface RecordInvoiceInput {
  orgId: string;
  supplierId: string;
  poId?: string | null;
  invoiceNo: string;
  amount: number;
  invoiceDate?: string | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Record a supplier invoice, then run the 3-way match if it references a PO. */
export async function recordInvoice(input: RecordInvoiceInput) {
  const [invoice] = await db
    .insert(supplierInvoices)
    .values({
      orgId: input.orgId,
      supplierId: input.supplierId,
      poId: input.poId ?? null,
      invoiceNo: input.invoiceNo,
      amount: input.amount.toString(),
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
    })
    .returning();
  if (!invoice) throw httpError("failed to record invoice", 500);
  if (!input.poId) return invoice;
  return matchInvoice(input.orgId, invoice.id);
}

/**
 * The 3-way match: compare what we ORDERED (PO lines), what we RECEIVED (GRN
 * lines), and what we were BILLED (invoice). The invoice is `matched` when it
 * agrees with the received value within tolerance, else `discrepancy` — and the
 * detail records all three figures so the gap is visible, never silently absorbed.
 */
export async function matchInvoice(orgId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(supplierInvoices)
    .where(and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.orgId, orgId)))
    .limit(1);
  if (!invoice) throw httpError("invoice not found", 404);
  if (!invoice.poId) throw httpError("invoice has no PO to match against", 400);

  const orderLines = await db
    .select({ qty: poLines.qtyOrdered, cost: poLines.unitCost })
    .from(poLines)
    .where(eq(poLines.poId, invoice.poId));
  const orderedValue = orderLines.reduce(
    (sum, l) => sum + Number(l.qty) * Number(l.cost ?? 0),
    0,
  );

  const receiptLines = await db
    .select({ qty: grnLines.qtyReceived, cost: grnLines.unitCost })
    .from(grnLines)
    .innerJoin(goodsReceipts, eq(goodsReceipts.id, grnLines.grnId))
    .where(eq(goodsReceipts.poId, invoice.poId));
  const receivedValue = receiptLines.reduce(
    (sum, l) => sum + Number(l.qty) * Number(l.cost ?? 0),
    0,
  );

  const invoiceAmount = Number(invoice.amount);
  const tolerance = 0.01;
  const matched = Math.abs(invoiceAmount - receivedValue) <= tolerance;

  const matchDetail = {
    orderedValue: round(orderedValue),
    receivedValue: round(receivedValue),
    invoiceAmount: round(invoiceAmount),
    invoiceVsReceived: round(invoiceAmount - receivedValue),
    orderedVsReceived: round(orderedValue - receivedValue),
  };

  const [updated] = await db
    .update(supplierInvoices)
    .set({ matchStatus: matched ? "matched" : "discrepancy", matchDetail })
    .where(eq(supplierInvoices.id, invoiceId))
    .returning();
  return updated;
}
