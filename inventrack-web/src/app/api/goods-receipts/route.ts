import { desc, eq } from "drizzle-orm";
import { receiveGoodsSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { goodsReceipts } from "@/server/db/schema";
import { receiveGoods } from "@/server/services/receiving";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(goodsReceipts)
    .where(eq(goodsReceipts.orgId, ctx.orgId))
    .orderBy(desc(goodsReceipts.receivedAt));
});

// Receive goods at the door — posts receipt movements and advances the PO.
export const POST = route({ permission: "grn.confirm" }, async ({ ctx, req }) => {
  const data = await parseBody(req, receiveGoodsSchema);
  const result = await receiveGoods({
    orgId: ctx.orgId,
    poId: data.poId ?? null,
    supplierId: data.supplierId ?? null,
    locationId: data.locationId,
    receivedByUserId: data.receivedByUserId ?? ctx.userId,
    note: data.note ?? null,
    lines: data.lines,
  });
  return created(result);
});
