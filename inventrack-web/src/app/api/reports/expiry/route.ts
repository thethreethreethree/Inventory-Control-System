import { expiry } from "@/server/services/reports";
import { route, query } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx, req }) => {
  const days = Number(query(req).get("days") ?? 30) || 30;
  return expiry(ctx.orgId, days);
});
