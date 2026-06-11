import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { createRecipeSchema } from "@ics/shared";
import { db } from "../db/client";
import { recipes, recipeComponents } from "../db/schema";
import { getOrgContext } from "../lib/context";
import { statusOf } from "../lib/errors";
import { createRecipe, getRecipeYield } from "../services/recipes";

export async function recipeRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const parsed = createRecipeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { orgId } = await getOrgContext();
    try {
      const recipe = await createRecipe({
        orgId,
        name: parsed.data.name,
        soldItemId: parsed.data.soldItemId ?? null,
        yieldQty: parsed.data.yieldQty,
        components: parsed.data.components,
      });
      return reply.code(201).send(recipe);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });

  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db.select().from(recipes).where(eq(recipes.orgId, orgId)).orderBy(asc(recipes.name));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    if (!recipe) return reply.code(404).send({ error: "not found" });
    const components = await db
      .select()
      .from(recipeComponents)
      .where(eq(recipeComponents.recipeId, id));
    return { ...recipe, components };
  });

  app.get("/:id/yield", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { orgId } = await getOrgContext();
    try {
      return await getRecipeYield(orgId, id);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });
}
