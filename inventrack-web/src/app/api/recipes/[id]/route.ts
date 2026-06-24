import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { recipes, recipeComponents } from "@/server/db/schema";
import { route, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ params }) => {
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
  if (!recipe) throw new HttpError(404, "not found");
  const components = await db
    .select()
    .from(recipeComponents)
    .where(eq(recipeComponents.recipeId, params.id));
  return { ...recipe, components };
});
