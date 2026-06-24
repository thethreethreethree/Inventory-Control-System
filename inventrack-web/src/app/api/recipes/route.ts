import { asc, eq } from "drizzle-orm";
import { createRecipeSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { recipes } from "@/server/db/schema";
import { createRecipe } from "@/server/services/recipes";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db.select().from(recipes).where(eq(recipes.orgId, ctx.orgId)).orderBy(asc(recipes.name));
});

export const POST = route({ permission: "item.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createRecipeSchema);
  const recipe = await createRecipe({
    orgId: ctx.orgId,
    name: data.name,
    soldItemId: data.soldItemId ?? null,
    yieldQty: data.yieldQty,
    components: data.components,
  });
  return created(recipe);
});
