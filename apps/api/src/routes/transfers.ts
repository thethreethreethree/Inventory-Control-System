import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createTransferSchema, confirmTransferSchema } from "@ics/shared";
import { db } from "../db/client";
import { transfers, transferLines } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { createTransfer, confirmTransfer } from "../services/transfers";

function statusOf(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    const s = (err as { statusCode?: unknown }).statusCode;
    if (typeof s === "number") return s;
  }
  return 500;
}

export async function transferRoutes(app: FastifyInstance) {
  // Create a transfer (source debited now; destination credited on confirm).
  app.post("/", async (req, reply) => {
    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const transfer = await createTransfer({
        orgId,
        fromLocationId: parsed.data.fromLocationId,
        toLocationId: parsed.data.toLocationId,
        reasonCode: parsed.data.reasonCode ?? null,
        issuedByUserId: parsed.data.issuedByUserId ?? defaultUserId,
        lines: parsed.data.lines,
      });
      return reply.code(201).send(transfer);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  // Receiver confirms the handoff.
  app.post("/:id/confirm", async (req, reply) => {
    const parsed = confirmTransferSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { id } = req.params as { id: string };
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      return await confirmTransfer(orgId, id, parsed.data.receivedByUserId ?? defaultUserId);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(transfers)
      .where(eq(transfers.orgId, orgId))
      .orderBy(desc(transfers.issuedAt));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [transfer] = await db.select().from(transfers).where(eq(transfers.id, id)).limit(1);
    if (!transfer) return reply.code(404).send({ error: "not found" });
    const lines = await db
      .select()
      .from(transferLines)
      .where(eq(transferLines.transferId, id));
    return { ...transfer, lines };
  });
}
