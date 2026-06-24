import { closePeriodSchema } from "@ics/shared";
import { closePeriod } from "@/server/services/periods";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route({ permission: "period.close" }, async ({ ctx, req, params }) => {
  const data = await parseBody(req, closePeriodSchema);
  return closePeriod(
    ctx.orgId,
    params.id,
    data.closedByUserId ?? ctx.userId,
    data.lock ?? true,
  );
});
