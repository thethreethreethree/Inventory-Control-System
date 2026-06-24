import { activity } from "@/server/services/reports";
import { route, query } from "@/server/http";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export const GET = route({}, async ({ ctx, req }) => {
  const q = query(req);
  const to = q.get("to") ?? new Date().toISOString();
  const from = q.get("from") ?? new Date(Date.now() - 30 * DAY_MS).toISOString();
  return activity(ctx.orgId, from, to);
});
