import { desc, eq } from "drizzle-orm";
import { createPurchaseOrderSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { purchaseOrders } from "@/server/db/schema";
import { createPurchaseOrder } from "@/server/services/purchasing";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.orgId, ctx.orgId))
    .orderBy(desc(purchaseOrders.orderedAt));
});

export const POST = route({ permission: "po.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createPurchaseOrderSchema);
  const po = await createPurchaseOrder({
    orgId: ctx.orgId,
    supplierId: data.supplierId,
    reference: data.reference ?? null,
    expectedAt: data.expectedAt ?? null,
    orderedByUserId: data.orderedByUserId ?? ctx.userId,
    note: data.note ?? null,
    lines: data.lines,
  });
  return created(po);
});
