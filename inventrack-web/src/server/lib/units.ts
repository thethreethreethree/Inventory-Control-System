import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { items, itemPackLevels, units } from "../db/schema";
import { httpError } from "./errors";

/** Resolve a unit code (e.g. "case") to its unit id within an org. */
export async function resolveUnitId(orgId: string, code: string): Promise<string> {
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.orgId, orgId), eq(units.code, code)))
    .limit(1);
  if (!unit) throw httpError(`unknown unit code: ${code}`, 400);
  return unit.id;
}

/**
 * Convert a quantity in `unitId` to the item's base unit using the item's
 * explicit pack hierarchy (case -> bottle -> ml). Falls back to factor 1 when
 * the unit IS the base unit. Throws when no conversion exists — an undefined
 * conversion is a known inventory hole, so we fail loudly rather than guess.
 */
export async function toBaseQty(
  orgId: string,
  itemId: string,
  unitId: string,
  qty: number,
): Promise<number> {
  const [pack] = await db
    .select({ qtyInBase: itemPackLevels.qtyInBase })
    .from(itemPackLevels)
    .where(
      and(
        eq(itemPackLevels.orgId, orgId),
        eq(itemPackLevels.itemId, itemId),
        eq(itemPackLevels.unitId, unitId),
      ),
    )
    .limit(1);
  if (pack) return qty * Number(pack.qtyInBase);

  const [item] = await db
    .select({ baseUnitId: items.baseUnitId })
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);
  if (item && item.baseUnitId === unitId) return qty;

  throw httpError(`no unit conversion for item ${itemId} from unit ${unitId}`, 400);
}
