import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createPurchaseOrderSchema, approvePurchaseOrderSchema } from "@ics/shared";
import { db } from "../db/client";
import { purchaseOrders, poLines } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { getCtx } from "../lib/auth";
import { statusOf } from "../lib/errors";
import { createPurchaseOrder, approvePurchaseOrder } from "../services/purchasing";

export async function purchaseOrderRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = createPurchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const po = await createPurchaseOrder({
        orgId,
        supplierId: parsed.data.supplierId,
        reference: parsed.data.reference ?? null,
        expectedAt: parsed.data.expectedAt ?? null,
        orderedByUserId: parsed.data.orderedByUserId ?? defaultUserId,
        note: parsed.data.note ?? null,
        lines: parsed.data.lines,
      });
      return reply.code(201).send(po);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  // Approve a draft PO. Approver must differ from the creator (separation of duties).
  app.post("/:id/approve", async (req, reply) => {
    const parsed = approvePurchaseOrderSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      // Approver is the authenticated user — not client-supplied (tamper-proof).
      return await approvePurchaseOrder(orgId, id, getCtx(req).userId);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.orgId, orgId))
      .orderBy(desc(purchaseOrders.orderedAt));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return reply.code(404).send({ error: "not found" });
    const lines = await db.select().from(poLines).where(eq(poLines.poId, id));
    return { ...po, lines };
  });
}
