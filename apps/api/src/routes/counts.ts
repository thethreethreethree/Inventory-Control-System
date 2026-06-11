import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createCountSchema, submitCountLinesSchema, postCountSchema } from "@ics/shared";
import { db } from "../db/client";
import { stockCounts, countLines } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { createCount, submitCountLines, postCount } from "../services/counts";

export async function countRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = createCountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const count = await createCount({
        orgId,
        locationId: parsed.data.locationId,
        scope: parsed.data.scope,
        blind: parsed.data.blind,
        startedByUserId: parsed.data.startedByUserId ?? defaultUserId,
        note: parsed.data.note ?? null,
      });
      return reply.code(201).send(count);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.post("/:id/lines", async (req, reply) => {
    const parsed = submitCountLinesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      return await submitCountLines({ orgId, countId: id, lines: parsed.data.lines });
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  // Post the count -> snapshot expected, compute variance, raise pending adjustments.
  app.post("/:id/post", async (req, reply) => {
    const parsed = postCountSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { id } = req.params as { id: string };
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      return await postCount(orgId, id, parsed.data.postedByUserId ?? defaultUserId);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(stockCounts)
      .where(eq(stockCounts.orgId, orgId))
      .orderBy(desc(stockCounts.startedAt));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [count] = await db.select().from(stockCounts).where(eq(stockCounts.id, id)).limit(1);
    if (!count) return reply.code(404).send({ error: "not found" });
    const lines = await db.select().from(countLines).where(eq(countLines.countId, id));
    return { ...count, lines };
  });
}
