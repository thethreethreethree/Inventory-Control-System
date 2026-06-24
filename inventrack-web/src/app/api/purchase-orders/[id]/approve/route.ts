import { approvePurchaseOrderSchema } from "@ics/shared";
import { approvePurchaseOrder } from "@/server/services/purchasing";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// Approve a draft PO. Approver must differ from the creator (separation of duties).
export const POST = route({ permission: "po.approve" }, async ({ ctx, req, params }) => {
  await parseBody(req, approvePurchaseOrderSchema);
  return approvePurchaseOrder(ctx.orgId, params.id, ctx.userId);
});
