import { submitCountLinesSchema } from "@ics/shared";
import { submitCountLines } from "@/server/services/counts";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = route({ permission: "count.create" }, async ({ ctx, req, params }) => {
  const data = await parseBody(req, submitCountLinesSchema);
  return submitCountLines({ orgId: ctx.orgId, countId: params.id, lines: data.lines });
});
