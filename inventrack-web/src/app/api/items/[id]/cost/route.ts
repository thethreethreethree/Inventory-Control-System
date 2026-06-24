import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { items } from "@/server/db/schema";
import { resolveUnitId, toBaseQty } from "@/server/lib/units";
import { route, parseBody, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

const setCostSchema = z.object({
  cost: z.number().nonnegative(),
  unitCode: z.string().min(1), // unit the cost is quoted in (e.g. "bottle")
});

// Set an item's fallback cost (quoted in any unit; stored per base unit).
export const PUT = route({ permission: "item.update" }, async ({ ctx, req, params }) => {
  const data = await parseBody(req, setCostSchema);
  const unitId = await resolveUnitId(ctx.orgId, data.unitCode);
  const basePerUnit = await toBaseQty(ctx.orgId, params.id, unitId, 1);
  if (basePerUnit <= 0) throw new HttpError(400, "invalid unit conversion");
  const costPerBase = data.cost / basePerUnit;
  await db
    .update(items)
    .set({ defaultCost: String(costPerBase) })
    .where(and(eq(items.id, params.id), eq(items.orgId, ctx.orgId)));
  return { ok: true, costPerBase };
});
