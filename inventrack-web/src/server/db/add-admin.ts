import { config } from "dotenv";

// Load env BEFORE importing the db client (which reads DATABASE_URL on import).
config({ path: ".env.local" });
config();

/**
 * Create (or update the password of) an Admin account. Idempotent — safe to run
 * any number of times. Defaults to john@hubandsky.local; override with env vars:
 *
 *   ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 *   pnpm db:add-admin
 */
async function main() {
  const { db } = await import("./client");
  const s = await import("./schema");
  const { and, eq } = await import("drizzle-orm");
  const { hashPassword } = await import("../lib/password");

  const name = process.env.ADMIN_NAME ?? "John";
  const email = process.env.ADMIN_EMAIL ?? "john@hubandsky.local";
  const password = process.env.ADMIN_PASSWORD ?? "ADMIN123!";

  const [org] = await db.select().from(s.orgs).limit(1);
  if (!org) throw new Error("No org yet — run `pnpm db:push` then `pnpm db:seed` first.");

  const [adminRole] = await db
    .select()
    .from(s.roles)
    .where(and(eq(s.roles.orgId, org.id), eq(s.roles.name, "Admin")))
    .limit(1);
  if (!adminRole) throw new Error("No Admin role found — run `pnpm db:seed` first.");

  const passwordHash = hashPassword(password);

  // Upsert the user by (org, email).
  const [existing] = await db
    .select()
    .from(s.users)
    .where(and(eq(s.users.orgId, org.id), eq(s.users.email, email)))
    .limit(1);

  let userId: string;
  if (existing) {
    await db
      .update(s.users)
      .set({ passwordHash, name, status: "active" })
      .where(eq(s.users.id, existing.id));
    userId = existing.id;
    console.log(`Updated existing user ${email} (password reset).`);
  } else {
    const [user] = await db
      .insert(s.users)
      .values({ orgId: org.id, name, email, passwordHash })
      .returning();
    userId = user.id;
    console.log(`Created user ${email}.`);
  }

  // Ensure the Admin role is assigned (no duplicate).
  const [link] = await db
    .select()
    .from(s.userRoles)
    .where(and(eq(s.userRoles.userId, userId), eq(s.userRoles.roleId, adminRole.id)))
    .limit(1);
  if (!link) {
    await db.insert(s.userRoles).values({ userId, roleId: adminRole.id });
  }

  console.log(`Done. Sign in with  ${email}  /  ${password}  (Admin).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
