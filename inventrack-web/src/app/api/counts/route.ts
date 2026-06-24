import { desc, eq } from "drizzle-orm";
import { createCountSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { stockCounts } from "@/server/db/schema";
import { createCount } from "@/server/services/counts";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(stockCounts)
    .where(eq(stockCounts.orgId, ctx.orgId))
    .orderBy(desc(stockCounts.startedAt));
});

export const POST = route({ permission: "count.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createCountSchema);
  const count = await createCount({
    orgId: ctx.orgId,
    locationId: data.locationId,
    scope: data.scope,
    blind: data.blind,
    startedByUserId: data.startedByUserId ?? ctx.userId,
    note: data.note ?? null,
  });
  return created(count);
});
