import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { orgs, users } from "../db/schema";

/**
 * Stopgap until the auth phase: resolve the single org and a default actor.
 * Authenticated requests will carry org + user from the session instead, and
 * this helper goes away. Kept tiny and obvious so it is easy to delete.
 */
export async function getOrgContext(): Promise<{
  orgId: string;
  defaultUserId: string | null;
}> {
  const [org] = await db.select().from(orgs).limit(1);
  if (!org) throw new Error("No org seeded — run `pnpm db:seed`");
  const [user] = await db.select().from(users).where(eq(users.orgId, org.id)).limit(1);
  return { orgId: org.id, defaultUserId: user?.id ?? null };
}
