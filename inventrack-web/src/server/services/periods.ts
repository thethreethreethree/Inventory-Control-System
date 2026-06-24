import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { periods } from "../db/schema";
import { httpError } from "../lib/errors";

type PeriodType = (typeof periods.$inferSelect)["type"];

export async function createPeriod(input: {
  orgId: string;
  type: PeriodType;
  startsAt: string;
  endsAt: string;
}) {
  const [period] = await db
    .insert(periods)
    .values({
      orgId: input.orgId,
      type: input.type,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    })
    .returning();
  if (!period) throw httpError("failed to create period", 500);
  return period;
}

/** Close (optionally lock) a period. A locked period rejects any backdated
 * movement into its window — see postMovement. */
export async function closePeriod(
  orgId: string,
  periodId: string,
  closedByUserId?: string | null,
  lock = true,
) {
  const [period] = await db
    .select()
    .from(periods)
    .where(and(eq(periods.id, periodId), eq(periods.orgId, orgId)))
    .limit(1);
  if (!period) throw httpError("period not found", 404);

  const [updated] = await db
    .update(periods)
    .set({
      status: lock ? "locked" : "closed",
      closedByUserId: closedByUserId ?? null,
      closedAt: new Date(),
    })
    .where(eq(periods.id, periodId))
    .returning();
  return updated;
}
