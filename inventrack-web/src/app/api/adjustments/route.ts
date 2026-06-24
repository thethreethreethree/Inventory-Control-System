import { desc, eq } from "drizzle-orm";
import { createAdjustmentSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { adjustments } from "@/server/db/schema";
import { createAdjustment } from "@/server/services/adjustments";
import { route, parseBody, created, query } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx, req }) => {
  const status = query(req).get("status");
  const rows = await db
    .select()
    .from(adjustments)
    .where(eq(adjustments.orgId, ctx.orgId))
    .orderBy(desc(adjustments.createdAt));
  return status ? rows.filter((r) => r.status === status) : rows;
});

// Create a manual adjustment request (pending until approved).
export const POST = route({ permission: "adjustment.request" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createAdjustmentSchema);
  const adjustment = await db.transaction((tx) =>
    createAdjustment(tx, {
      orgId: ctx.orgId,
      itemId: data.itemId,
      locationId: data.locationId,
      baseQtyDelta: data.baseQtyDelta,
      reason: data.reason,
      requestedByUserId: data.requestedByUserId ?? ctx.userId,
      note: data.note ?? null,
    }),
  );
  return created(adjustment);
});
