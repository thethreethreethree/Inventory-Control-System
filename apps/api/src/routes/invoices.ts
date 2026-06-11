import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { recordInvoiceSchema } from "@ics/shared";
import { db } from "../db/client";
import { supplierInvoices, attachments } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { recordInvoice, matchInvoice } from "../services/invoicing";

export async function invoiceRoutes(app: FastifyInstance) {
  // Record an invoice; runs the 3-way match automatically when linked to a PO.
  app.post("/", async (req, reply) => {
    const parsed = recordInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId } = await getOrgContext();
    try {
      const invoice = await recordInvoice({
        orgId,
        supplierId: parsed.data.supplierId,
        poId: parsed.data.poId ?? null,
        invoiceNo: parsed.data.invoiceNo,
        amount: parsed.data.amount,
        invoiceDate: parsed.data.invoiceDate ?? null,
        attachmentId: parsed.data.attachmentId ?? null,
      });
      return reply.code(201).send(invoice);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.post("/:id/match", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      return await matchInvoice(orgId, id);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
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
      .where(eq(supplierInvoices.orgId, orgId))
      .orderBy(desc(supplierInvoices.createdAt));
  });
}
