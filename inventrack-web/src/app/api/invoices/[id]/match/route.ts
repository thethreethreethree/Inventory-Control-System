import { matchInvoice } from "@/server/services/invoicing";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

// Re-run the 3-way match for an invoice (ordered vs received vs billed).
export const POST = route({ permission: "po.create" }, async ({ ctx, params }) => {
  return matchInvoice(ctx.orgId, params.id);
});
