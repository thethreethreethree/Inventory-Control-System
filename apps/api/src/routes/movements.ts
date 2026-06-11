import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { recordMovementSchema, MOVEMENT_DELTA } from "@ics/shared";
import { db } from "../db/client";
import { movements, items, locations } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { postMovement } from "../services/ledger";

export async function movementRoutes(app: FastifyInstance) {
  // Record a stock movement. `qty` is a positive magnitude; the server derives
  // the signed delta from the type, so a caller can't turn an issue into a gain.
  app.post("/", async (req, reply) => {
    const parsed = recordMovementSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const input = parsed.data;
    const { orgId, defaultUserId } = await getOrgContext();
    const signedBaseQty = MOVEMENT_DELTA[input.movementType] * input.qty;

    const movement = await db.transaction((tx) =>
      postMovement(tx, {
        orgId,
        itemId: input.itemId,
        locationId: input.locationId,
        signedBaseQty,
        movementType: input.movementType,
        reasonCode: input.reasonCode ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        actorUserId: input.actorUserId ?? defaultUserId,
        counterpartyUserId: input.counterpartyUserId ?? null,
      }),
    );
    return reply.code(201).send(movement);
  });

  // Ledger view: recent movements, optionally filtered by item/location.
  app.get("/", async (req) => {
    const q = req.query as { itemId?: string; locationId?: string; limit?: string };
    const conds = [];
    if (q.itemId) conds.push(eq(movements.itemId, q.itemId));
    if (q.locationId) conds.push(eq(movements.locationId, q.locationId));
    const limit = Math.min(Number(q.limit ?? 50) || 50, 200);

    return db
      .select({
        id: movements.id,
        seq: movements.seq,
        item: items.name,
        location: locations.name,
        baseQty: movements.baseQty,
        type: movements.movementType,
        reason: movements.reasonCode,
        occurredAt: movements.occurredAt,
      })
      .from(movements)
      .innerJoin(items, eq(items.id, movements.itemId))
      .innerJoin(locations, eq(locations.id, movements.locationId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(movements.seq))
      .limit(limit);
  });
}
