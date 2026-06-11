import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { receiveGoodsSchema } from "@ics/shared";
import { db } from "../db/client";
import { goodsReceipts, grnLines } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { receiveGoods } from "../services/receiving";

export async function goodsReceiptRoutes(app: FastifyInstance) {
  // Receive goods at the door — posts receipt movements and advances the PO.
  app.post("/", async (req, reply) => {
    const parsed = receiveGoodsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const result = await receiveGoods({
        orgId,
        poId: parsed.data.poId ?? null,
        supplierId: parsed.data.supplierId ?? null,
        locationId: parsed.data.locationId,
        receivedByUserId: parsed.data.receivedByUserId ?? defaultUserId,
        note: parsed.data.note ?? null,
        lines: parsed.data.lines,
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(goodsReceipts)
      .where(eq(goodsReceipts.orgId, orgId))
      .orderBy(desc(goodsReceipts.receivedAt));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [grn] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id)).limit(1);
    if (!grn) return reply.code(404).send({ error: "not found" });
    const lines = await db.select().from(grnLines).where(eq(grnLines.grnId, id));
    return { ...grn, lines };
  });
}
