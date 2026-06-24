import { config } from "dotenv";

// Load env BEFORE importing the db client (which reads DATABASE_URL on import).
config({ path: ".env.local" });
config();

/**
 * One-time setup for a fresh database: the org, base units, the full permission
 * catalogue, the system roles with their grants, the team's user accounts, and
 * the three locations. Idempotent — it bails if an org already exists.
 *
 *   pnpm db:push   # create the tables from the schema
 *   pnpm db:seed   # then run this
 */
async function main() {
  const { db } = await import("./client");
  const s = await import("./schema");
  const { BASE_UNITS, PERMISSIONS, SYSTEM_ROLES, ROLE_PERMISSIONS } = await import(
    "../../shared/index"
  );
  const { hashPassword } = await import("../lib/password");

  const existing = await db.select().from(s.orgs).limit(1);
  if (existing.length) {
    console.log("An org already exists — skipping seed. (Clear the data to re-seed.)");
    return;
  }

  const [org] = await db.insert(s.orgs).values({ name: "Hub & Sky Bar" }).returning();

  // Base units of measure.
  await db.insert(s.units).values(
    BASE_UNITS.map((u) => ({
      orgId: org.id,
      code: u.code,
      name: u.name,
      dimension: u.dimension as never,
    })),
  );

  // Permission catalogue (global table keyed by `key`).
  const permRows = await db
    .insert(s.permissions)
    .values(PERMISSIONS.map((key) => ({ key })))
    .returning();
  const permByKey = new Map(permRows.map((p) => [p.key, p.id]));

  // System roles + their permission grants.
  const roleByName = new Map<string, string>();
  for (const roleName of SYSTEM_ROLES) {
    const [role] = await db
      .insert(s.roles)
      .values({ orgId: org.id, name: roleName, isSystem: true })
      .returning();
    roleByName.set(roleName, role.id);
    const grant = ROLE_PERMISSIONS[roleName];
    const keys = grant === "*" ? PERMISSIONS : grant;
    if (keys.length) {
      await db.insert(s.rolePermissions).values(
        keys.map((k) => ({ roleId: role.id, permissionId: permByKey.get(k)! })),
      );
    }
  }

  // The team. Admins manage everything; Staff may only enter inventory counts.
  // Per-member password optional; everyone else gets the shared default.
  const team: { name: string; email: string; role: string; password?: string }[] = [
    { name: "John", email: "john@hubandsky.local", role: "Admin", password: "ADMIN123!" },
    { name: "Maria Anna", email: "maria@hubandsky.local", role: "Admin" },
    { name: "Bredily", email: "bredily@hubandsky.local", role: "Admin" },
    { name: "Remy", email: "remy@hubandsky.local", role: "Admin" },
    { name: "Malou", email: "malou@hubandsky.local", role: "Admin" },
    { name: "Nikko", email: "nikko@hubandsky.local", role: "Staff" },
    { name: "Jason", email: "jason@hubandsky.local", role: "Staff" },
  ];
  for (const member of team) {
    const [user] = await db
      .insert(s.users)
      .values({
        orgId: org.id,
        name: member.name,
        email: member.email,
        passwordHash: hashPassword(member.password ?? "inventrack123"),
      })
      .returning();
    await db.insert(s.userRoles).values({ userId: user.id, roleId: roleByName.get(member.role)! });
  }

  // Locations.
  const locs: [string, string][] = [
    ["FRENDZ&HUB", "bar"],
    ["Saboria", "bar"],
    ["Twinbeach", "bar"],
  ];
  await db.insert(s.locations).values(
    locs.map(([name, type]) => ({ orgId: org.id, name, type: type as never })),
  );

  console.log("Seeded org, units, permissions, roles, 6 users and 3 locations.");
  console.log("Sign in with  maria@hubandsky.local  /  inventrack123  (Admin).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
