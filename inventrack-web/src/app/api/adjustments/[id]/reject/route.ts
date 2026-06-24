import { reviewAdjustmentSchema } from "@ics/shared";
import { rejectAdjustment } from "@/server/services/adjustments";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route({ permission: "adjustment.approve" }, async ({ ctx, req, params }) => {
  const data = await parseBody(req, reviewAdjustmentSchema);
  return rejectAdjustment(ctx.orgId, params.id, ctx.userId, data.note ?? null);
});
