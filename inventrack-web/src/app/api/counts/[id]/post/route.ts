import { postCountSchema } from "@ics/shared";
import { postCount } from "@/server/services/counts";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

// Post the count -> snapshot expected, compute variance, raise pending adjustments.
export const POST = route({ permission: "count.post" }, async ({ ctx, req, params }) => {
  await parseBody(req, postCountSchema);
  // Poster is the authenticated user; a different user must approve the variance.
  return postCount(ctx.orgId, params.id, ctx.userId);
});
