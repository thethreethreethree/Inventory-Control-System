import { inArray } from "drizzle-orm";
import { db } from "../db/client";
import { salesImports, salesLines, recipeComponents } from "../db/schema";
import { httpError } from "../lib/errors";
import { postMovement } from "./ledger";

type SalesSource = (typeof salesImports.$inferSelect)["source"];
type RecipeComponent = typeof recipeComponents.$inferSelect;

export interface IngestSalesInput {
  orgId: string;
  source?: SalesSource;
  locationId: string;
  importedByUserId?: string | null;
  reference?: string | null;
  lines: { recipeId: string; qtySold: number; soldAt?: string | null }[];
}

/**
 * Hybrid depletion: each sold line is exploded through its recipe into `issue`
 * movements that deplete the components from the sale location. This is how
 * consumption is captured without keying every pour — the manual surface stays
 * small (waste/transfers/counts), which is where accuracy actually comes from.
 */
export async function ingestSales(input: IngestSalesInput) {
  const recipeIds = [...new Set(input.lines.map((l) => l.recipeId))];
  const comps = await db
    .select()
    .from(recipeComponents)
    .where(inArray(recipeComponents.recipeId, recipeIds));

  const byRecipe = new Map<string, RecipeComponent[]>();
  for (const c of comps) {
    const arr = byRecipe.get(c.recipeId) ?? [];
    arr.push(c);
    byRecipe.set(c.recipeId, arr);
  }
  for (const id of recipeIds) {
    if (!byRecipe.has(id)) {
      throw httpError(`recipe ${id} has no components or does not exist`, 400);
    }
  }

  const depletions = new Map<string, number>();
  const imp = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(salesImports)
      .values({
        orgId: input.orgId,
        source: input.source ?? "manual",
        locationId: input.locationId,
        reference: input.reference ?? null,
        importedByUserId: input.importedByUserId ?? null,
      })
      .returning();
    if (!created) throw httpError("failed to create sales import", 500);

    for (const line of input.lines) {
      await tx.insert(salesLines).values({
        orgId: input.orgId,
        salesImportId: created.id,
        recipeId: line.recipeId,
        qtySold: line.qtySold.toString(),
        soldAt: line.soldAt ? new Date(line.soldAt) : new Date(),
      });

      for (const c of byRecipe.get(line.recipeId) ?? []) {
        const deplete = line.qtySold * Number(c.baseQty);
        await postMovement(tx, {
          orgId: input.orgId,
          itemId: c.componentItemId,
          locationId: input.locationId,
          signedBaseQty: -deplete,
          movementType: "issue",
          reasonCode: "sale",
          actorUserId: input.importedByUserId ?? null,
          refType: "sale",
          refId: created.id,
          occurredAt: line.soldAt ? new Date(line.soldAt) : undefined,
        });
        depletions.set(c.componentItemId, (depletions.get(c.componentItemId) ?? 0) + deplete);
      }
    }
    return created;
  });

  return {
    salesImportId: imp.id,
    depletions: [...depletions.entries()].map(([itemId, baseQty]) => ({ itemId, baseQty })),
  };
}
