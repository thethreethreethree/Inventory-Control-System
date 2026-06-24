import { confirmTransferSchema } from "@ics/shared";
import { confirmTransfer } from "@/server/services/transfers";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// Receiver confirms the handoff.
export const POST = route({ permission: "transfer.confirm" }, async ({ ctx, req, params }) => {
  const input = await parseBody(req, confirmTransferSchema);
  return confirmTransfer(ctx.orgId, params.id, input.receivedByUserId ?? ctx.userId);
});
