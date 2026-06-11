import type { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { getOrgContext } from "../lib/context";

export async function userRoutes(app: FastifyInstance) {
  // Temporary read-only list until the auth phase builds full user management.
  app.get("/", async () => {
    const { orgId } = await getOrgContext();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(eq(users.orgId, orgId))
      .orderBy(asc(users.name));
  });
}
