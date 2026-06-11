import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createPeriodSchema, closePeriodSchema } from "@ics/shared";
import { db } from "../db/client";
import { periods } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { createPeriod, closePeriod } from "../services/periods";

export async function periodRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = createPeriodSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = await getOrgContext();
    try {
      const period = await createPeriod({
        orgId,
        type: parsed.data.type,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
      });
      return reply.code(201).send(period);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.post("/:id/close", async (req, reply) => {
    const parsed = closePeriodSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      return await closePeriod(
        orgId,
        id,
        parsed.data.closedByUserId ?? defaultUserId,
        parsed.data.lock ?? true,
      );
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(periods)
      .where(eq(periods.orgId, orgId))
      .orderBy(desc(periods.startsAt));
  });
}
