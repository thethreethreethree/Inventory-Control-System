import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { createCategorySchema } from "@ics/shared";
import { db } from "../db/client";
import { categories } from "../db/schema";
import { getCtx } from "../lib/auth";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const { orgId } = getCtx(req);
    return db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.orgId, orgId))
      .orderBy(asc(categories.name));
  });

  app.post("/", async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = getCtx(req);
    const [category] = await db
      .insert(categories)
      .values({ orgId, name: parsed.data.name })
      .returning();
    return reply.code(201).send(category);
  });
}
