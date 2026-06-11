import type { FastifyInstance } from "fastify";
import { asc } from "drizzle-orm";
import { db } from "../db/client";
import { items } from "../db/schema";

export async function itemRoutes(app: FastifyInstance) {
  // Org-scoping + permission middleware lands with the auth phase; one org for now.
  app.get("/", async () => {
    return db
      .select({
        id: items.id,
        sku: items.sku,
        name: items.name,
        brand: items.brand,
        itemType: items.itemType,
        status: items.status,
      })
      .from(items)
      .orderBy(asc(items.name));
  });
}
