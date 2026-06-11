import type { FastifyInstance } from "fastify";
import { asc } from "drizzle-orm";
import { db } from "../db/client";
import { locations } from "../db/schema";

export async function locationRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return db
      .select({
        id: locations.id,
        name: locations.name,
        type: locations.type,
        active: locations.active,
      })
      .from(locations)
      .orderBy(asc(locations.name));
  });
}
