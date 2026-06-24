import { asc, eq } from "drizzle-orm";
import { createCategorySchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { categories } from "@/server/db/schema";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.orgId, ctx.orgId))
    .orderBy(asc(categories.name));
});

export const POST = route({ permission: "item.create" }, async ({ ctx, req }) => {
  const input = await parseBody(req, createCategorySchema);
  const [category] = await db
    .insert(categories)
    .values({ orgId: ctx.orgId, name: input.name })
    .returning();
  return created(category);
});
