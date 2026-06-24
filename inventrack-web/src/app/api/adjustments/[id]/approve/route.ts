import { reviewAdjustmentSchema } from "@ics/shared";
import { approveAdjustment } from "@/server/services/adjustments";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route({ permission: "adjustment.approve" }, async ({ ctx, req, params }) => {
  await parseBody(req, reviewAdjustmentSchema);
  // Reviewer is the authenticated user (separation of duties is tamper-proof).
  return approveAdjustment(ctx.orgId, params.id, ctx.userId);
});
