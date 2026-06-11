import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { createSupplierSchema } from "@ics/shared";
import { db } from "../db/client";
import { suppliers } from "../db/schema";
import { getOrgContext } from "../lib/context";

export async function supplierRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = createSupplierSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { orgId } = await getOrgContext();
    const [supplier] = await db
      .insert(suppliers)
      .values({
        orgId,
        name: parsed.data.name,
        terms: parsed.data.terms ?? null,
        leadTimeDays: parsed.data.leadTimeDays ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
      })
      .returning();
    return reply.code(201).send(supplier);
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select()
      .from(suppliers)
      .where(eq(suppliers.orgId, orgId))
      .orderBy(asc(suppliers.name));
  });
}
