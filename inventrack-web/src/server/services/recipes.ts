import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { recipes, recipeComponents, items, itemPackLevels, units } from "../db/schema";
import { httpError } from "../lib/errors";
import { resolveUnitId, toBaseQty } from "../lib/units";

export interface CreateRecipeInput {
  orgId: string;
  name: string;
  soldItemId?: string | null;
  yieldQty?: number;
  components: { itemId: string; qty: number; unitCode: string }[];
}

/** A recipe consumes its components per serving; quantities are stored in base
 * units so depletion at sale time is a simple multiply. */
export async function createRecipe(input: CreateRecipeInput) {
  const resolved: { itemId: string; qty: number; unitId: string; baseQty: number }[] = [];
  for (const c of input.components) {
    const unitId = await resolveUnitId(input.orgId, c.unitCode);
    const baseQty = await toBaseQty(input.orgId, c.itemId, unitId, c.qty);
    resolved.push({ itemId: c.itemId, qty: c.qty, unitId, baseQty });
  }

  return db.transaction(async (tx) => {
    const [recipe] = await tx
      .insert(recipes)
      .values({
        orgId: input.orgId,
        name: input.name,
        soldItemId: input.soldItemId ?? null,
        yieldQty: (input.yieldQty ?? 1).toString(),
      })
      .returning();
    if (!recipe) throw httpError("failed to create recipe", 500);

    for (const c of resolved) {
      await tx.insert(recipeComponents).values({
        orgId: input.orgId,
        recipeId: recipe.id,
        componentItemId: c.itemId,
        qty: c.qty.toString(),
        unitId: c.unitId,
        baseQty: c.baseQty.toString(),
      });
    }
    return recipe;
  });
}

/**
 * Theoretical yield: servings obtainable per stock unit of each component
 * (e.g. 750 ml bottle / 45 ml pour = 16.67 G&Ts per bottle). The gap between
 * this and the actual depletion a count reveals is the over-pour hole.
 */
export async function getRecipeYield(orgId: string, recipeId: string) {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.orgId, orgId)))
    .limit(1);
  if (!recipe) throw httpError("recipe not found", 404);

  const comps = await db
    .select()
    .from(recipeComponents)
    .where(eq(recipeComponents.recipeId, recipeId));

  const components = [];
  for (const c of comps) {
    const [item] = await db
      .select({ name: items.name, stockUnitId: items.stockUnitId })
      .from(items)
      .where(eq(items.id, c.componentItemId))
      .limit(1);
    const perServingBase = Number(c.baseQty);

    let stockUnit: string | null = null;
    let servingsPerStockUnit: number | null = null;
    if (item?.stockUnitId && perServingBase > 0) {
      const [pack] = await db
        .select({ qtyInBase: itemPackLevels.qtyInBase })
        .from(itemPackLevels)
        .where(
          and(
            eq(itemPackLevels.itemId, c.componentItemId),
            eq(itemPackLevels.unitId, item.stockUnitId),
          ),
        )
        .limit(1);
      const [su] = await db
        .select({ code: units.code })
        .from(units)
        .where(eq(units.id, item.stockUnitId))
        .limit(1);
      if (pack) {
        stockUnit = su?.code ?? null;
        servingsPerStockUnit =
          Math.round((Number(pack.qtyInBase) / perServingBase) * 100) / 100;
      }
    }
    components.push({
      item: item?.name ?? null,
      perServingBase,
      stockUnit,
      servingsPerStockUnit,
    });
  }
  return { recipe: recipe.name, components };
}
