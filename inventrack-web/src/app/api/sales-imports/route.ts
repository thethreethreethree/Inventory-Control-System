import { desc, eq } from "drizzle-orm";
import { ingestSalesSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { salesImports } from "@/server/db/schema";
import { ingestSales } from "@/server/services/sales";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(salesImports)
    .where(eq(salesImports.orgId, ctx.orgId))
    .orderBy(desc(salesImports.importedAt));
});

// Ingest sales -> explode via recipes -> issue movements (auto-depletion).
export const POST = route({ permission: "movement.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, ingestSalesSchema);
  const result = await ingestSales({
    orgId: ctx.orgId,
    source: data.source,
    locationId: data.locationId,
    importedByUserId: data.importedByUserId ?? ctx.userId,
    reference: data.reference ?? null,
    lines: data.lines,
  });
  return created(result);
});
