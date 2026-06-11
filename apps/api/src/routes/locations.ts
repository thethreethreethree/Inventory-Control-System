import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { createLocationSchema } from "@ics/shared";
import { db } from "../db/client";
import { locations } from "../db/schema";
import { getCtx } from "../lib/auth";

export async function locationRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const { orgId } = getCtx(req);
    return db
      .select({
        id: locations.id,
        name: locations.name,
        type: locations.type,
        active: locations.active,
      })
      .from(locations)
      .where(eq(locations.orgId, orgId))
      .orderBy(asc(locations.name));
  });

  app.post("/", async (req, reply) => {
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = getCtx(req);
    const [location] = await db
      .insert(locations)
      .values({ orgId, name: parsed.data.name, type: (parsed.data.type ?? "other") as never })
      .returning();
    return reply.code(201).send(location);
  });
}
