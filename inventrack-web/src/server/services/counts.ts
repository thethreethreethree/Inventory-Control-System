import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { stockCounts, countLines, items } from "../db/schema";
import { httpError } from "../lib/errors";
import { resolveUnitId, toBaseQty } from "../lib/units";
import { getLedgerBalance } from "./ledger";
import { createAdjustment } from "./adjustments";

type CountScope = (typeof stockCounts.$inferSelect)["scope"];

export interface CreateCountInput {
  orgId: string;
  locationId: string;
  scope?: CountScope;
  blind?: boolean;
  startedByUserId?: string | null;
  note?: string | null;
}

export async function createCount(input: CreateCountInput) {
  const [count] = await db
    .insert(stockCounts)
    .values({
      orgId: input.orgId,
      locationId: input.locationId,
      scope: input.scope ?? "daily_spot",
      blind: input.blind ?? true,
      startedByUserId: input.startedByUserId ?? null,
      note: input.note ?? null,
    })
    .returning();
  if (!count) throw httpError("failed to create count", 500);
  return count;
}

export interface SubmitLinesInput {
  orgId: string;
  countId: string;
  lines: { itemId: string; countedQty: number; unitCode: string }[];
}

/** Record counted quantities (in any unit; converted to base). Counting only —
 * variance is computed at post time so the counter works blind. */
export async function submitCountLines(input: SubmitLinesInput) {
  const [count] = await db
    .select()
    .from(stockCounts)
    .where(and(eq(stockCounts.id, input.countId), eq(stockCounts.orgId, input.orgId)))
    .limit(1);
  if (!count) throw httpError("count not found", 404);
  if (count.status !== "counting") throw httpError(`count is ${count.status}`, 409);

  const resolved: { itemId: string; countedBaseQty: number }[] = [];
  for (const line of input.lines) {
    const unitId = await resolveUnitId(input.orgId, line.unitCode);
    const countedBaseQty = await toBaseQty(input.orgId, line.itemId, unitId, line.countedQty);
    resolved.push({ itemId: line.itemId, countedBaseQty });
  }

  await db.transaction(async (tx) => {
    for (const r of resolved) {
      await tx
        .insert(countLines)
        .values({
          orgId: input.orgId,
          countId: input.countId,
          itemId: r.itemId,
          countedBaseQty: r.countedBaseQty.toString(),
        })
        .onConflictDoUpdate({
          target: [countLines.countId, countLines.itemId],
          set: { countedBaseQty: r.countedBaseQty.toString() },
        });
    }
  });
  return { submitted: resolved.length };
}

/**
 * Post the count: snapshot the theoretical on-hand (from the ledger) for each
 * line, compute variance, and raise a PENDING adjustment for every non-zero
 * variance. Stock is NOT changed here — corrections require approval. This is
 * the reconciliation step: what should be there vs. what is.
 */
export async function postCount(orgId: string, countId: string, postedByUserId?: string | null) {
  const [count] = await db
    .select()
    .from(stockCounts)
    .where(and(eq(stockCounts.id, countId), eq(stockCounts.orgId, orgId)))
    .limit(1);
  if (!count) throw httpError("count not found", 404);
  if (count.status !== "counting") throw httpError(`count is ${count.status}`, 409);

  const lines = await db.select().from(countLines).where(eq(countLines.countId, countId));

  return db.transaction(async (tx) => {
    const variances = [];
    for (const line of lines) {
      const expected = await getLedgerBalance(orgId, line.itemId, count.locationId);
      const counted = Number(line.countedBaseQty);
      const variance = counted - expected; // + surplus, - shortage

      const [item] = await tx
        .select({ tol: items.tolerancePct })
        .from(items)
        .where(eq(items.id, line.itemId))
        .limit(1);
      const tolPct = item?.tol != null ? Number(item.tol) : 0;
      const withinTolerance =
        expected > 0 ? Math.abs(variance) <= expected * (tolPct / 100) : variance === 0;

      let adjustmentId: string | null = null;
      if (variance !== 0) {
        const adj = await createAdjustment(tx, {
          orgId,
          itemId: line.itemId,
          locationId: count.locationId,
          baseQtyDelta: variance,
          reason: "count_variance",
          refType: "count",
          refId: countId,
          requestedByUserId: postedByUserId ?? null,
        });
        adjustmentId = adj.id;
      }

      await tx
        .update(countLines)
        .set({
          expectedBaseQty: expected.toString(),
          varianceBase: variance.toString(),
          withinTolerance,
          adjustmentId,
        })
        .where(eq(countLines.id, line.id));

      variances.push({
        itemId: line.itemId,
        counted,
        expected,
        variance,
        withinTolerance,
        adjustmentId,
      });
    }

    await tx
      .update(stockCounts)
      .set({ status: "posted", postedByUserId: postedByUserId ?? null, postedAt: new Date() })
      .where(eq(stockCounts.id, countId));

    return { countId, variances };
  });
}
