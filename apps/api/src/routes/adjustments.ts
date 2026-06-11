import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createAdjustmentSchema, reviewAdjustmentSchema } from "@ics/shared";
import { db } from "../db/client";
import { adjustments } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { getCtx } from "../lib/auth";
import { statusOf } from "../lib/errors";
import { createAdjustment, approveAdjustment, rejectAdjustment } from "../services/adjustments";

export async function adjustmentRoutes(app: FastifyInstance) {
  // Create a manual adjustment request (pending until approved).
  app.post("/", async (req, reply) => {
    const parsed = createAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const adjustment = await db.transaction((tx) =>
        createAdjustment(tx, {
          orgId,
          itemId: parsed.data.itemId,
          locationId: parsed.data.locationId,
          baseQtyDelta: parsed.data.baseQtyDelta,
          reason: parsed.data.reason,
          requestedByUserId: parsed.data.requestedByUserId ?? defaultUserId,
          note: parsed.data.note ?? null,
        }),
      );
      return reply.code(201).send(adjustment);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.post("/:id/approve", async (req, reply) => {
    const parsed = reviewAdjustmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      // Reviewer is the authenticated user (separation of duties is tamper-proof).
      return await approveAdjustment(orgId, id, getCtx(req).userId);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.post("/:id/reject", async (req, reply) => {
    const parsed = reviewAdjustmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      return await rejectAdjustment(orgId, id, getCtx(req).userId, parsed.data.note ?? null);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async (req) => {
    const q = req.query as { status?: string };
    const { orgId } = await getOrgContext();
    const rows = await db
      .select()
      .from(adjustments)
      .where(eq(adjustments.orgId, orgId))
      .orderBy(desc(adjustments.createdAt));
    return q.status ? rows.filter((r) => r.status === q.status) : rows;
  });
}
