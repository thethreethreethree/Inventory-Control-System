import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { ingestSalesSchema } from "@ics/shared";
import { db } from "../db/client";
import { salesImports, salesLines } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { ingestSales } from "../services/sales";

export async function salesImportRoutes(app: FastifyInstance) {
  // Ingest sales -> explode via recipes -> issue movements (auto-depletion).
  app.post("/", async (req, reply) => {
    const parsed = ingestSalesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId, defaultUserId } = await getOrgContext();
    try {
      const result = await ingestSales({
        orgId,
        source: parsed.data.source,
        locationId: parsed.data.locationId,
        importedByUserId: parsed.data.importedByUserId ?? defaultUserId,
        reference: parsed.data.reference ?? null,
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
      .from(salesImports)
      .where(eq(salesImports.orgId, orgId))
      .orderBy(desc(salesImports.importedAt));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [imp] = await db.select().from(salesImports).where(eq(salesImports.id, id)).limit(1);
    if (!imp) return reply.code(404).send({ error: "not found" });
    const lines = await db.select().from(salesLines).where(eq(salesLines.salesImportId, id));
    return { ...imp, lines };
  });
}
