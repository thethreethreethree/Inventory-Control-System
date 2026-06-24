import { getRecipeYield } from "@/server/services/recipes";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx, params }) => {
  return getRecipeYield(ctx.orgId, params.id);
});
