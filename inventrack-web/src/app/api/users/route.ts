import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

// Temporary read-only list until the auth phase builds full user management.
export const GET = route({}, async ({ ctx }) => {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
    })
    .from(users)
    .where(eq(users.orgId, ctx.orgId))
    .orderBy(asc(users.name));
});
