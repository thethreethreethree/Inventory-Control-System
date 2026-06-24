import { desc, eq } from "drizzle-orm";
import { createPeriodSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { periods } from "@/server/db/schema";
import { createPeriod } from "@/server/services/periods";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(periods)
    .where(eq(periods.orgId, ctx.orgId))
    .orderBy(desc(periods.startsAt));
});

export const POST = route({ permission: "period.close" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createPeriodSchema);
  const period = await createPeriod({
    orgId: ctx.orgId,
    type: data.type,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
  });
  return created(period);
});
