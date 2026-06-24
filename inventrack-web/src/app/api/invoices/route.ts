import { desc, eq } from "drizzle-orm";
import { recordInvoiceSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { supplierInvoices, attachments } from "@/server/db/schema";
import { recordInvoice } from "@/server/services/invoicing";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select({
      id: supplierInvoices.id,
      supplierId: supplierInvoices.supplierId,
      poId: supplierInvoices.poId,
      invoiceNo: supplierInvoices.invoiceNo,
      amount: supplierInvoices.amount,
      matchStatus: supplierInvoices.matchStatus,
      matchDetail: supplierInvoices.matchDetail,
      attachmentId: supplierInvoices.attachmentId,
      attachmentUrl: attachments.fileUrl,
    })
    .from(supplierInvoices)
    .leftJoin(attachments, eq(attachments.id, supplierInvoices.attachmentId))
    .where(eq(supplierInvoices.orgId, ctx.orgId))
    .orderBy(desc(supplierInvoices.createdAt));
});

// Record an invoice; runs the 3-way match automatically when linked to a PO.
export const POST = route({ permission: "po.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, recordInvoiceSchema);
  const invoice = await recordInvoice({
    orgId: ctx.orgId,
    supplierId: data.supplierId,
    poId: data.poId ?? null,
    invoiceNo: data.invoiceNo,
    amount: data.amount,
    invoiceDate: data.invoiceDate ?? null,
    attachmentId: data.attachmentId ?? null,
  });
  return created(invoice);
});
