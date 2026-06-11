import { eq } from "drizzle-orm";
import { PERMISSIONS, ROLE_PERMISSIONS, type SystemRole } from "@ics/shared";
import { db, sqlClient } from "./client";
import { orgs, users, roles, permissions, rolePermissions, userRoles } from "./schema";
import { hashPassword } from "../lib/password";

/** The real team. Passwords are initial defaults — change them once a
 * change-password flow exists. */
const TEAM: { name: string; email: string; password: string; role: SystemRole }[] = [
  { name: "Maria Anna", email: "maria.anna@hubsky.local", password: "maria123", role: "Admin" },
  { name: "Bredily", email: "bredily@hubsky.local", password: "bredily123", role: "Admin" },
  { name: "Remy", email: "remy@hubsky.local", password: "remy123", role: "Admin" },
  { name: "Malou", email: "malou@hubsky.local", password: "malou123", role: "Admin" },
  { name: "Nikko", email: "nikko@hubsky.local", password: "nikko123", role: "Staff" },
  { name: "Jason", email: "jason@hubsky.local", password: "jason123", role: "Staff" },
];

async function main() {
  const [org] = await db.select().from(orgs).limit(1);
  if (!org) throw new Error("no org — run db:import first");
  const orgId = org.id;

  const roleRows = await db.select().from(roles).where(eq(roles.orgId, orgId));
  const roleByName = new Map(roleRows.map((r) => [r.name as SystemRole, r.id]));
  const permRows = await db.select().from(permissions);
  const permByKey = new Map(permRows.map((p) => [p.key, p.id]));

  // 1) Re-sync the Staff role to its (now restricted) permission set.
  const staffRoleId = roleByName.get("Staff");
  if (staffRoleId) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, staffRoleId));
    const grant = ROLE_PERMISSIONS.Staff;
    const keys = grant === "*" ? PERMISSIONS : grant;
    const vals = keys
      .map((k) => permByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: staffRoleId, permissionId }));
    if (vals.length) await db.insert(rolePermissions).values(vals);
    console.log(`Staff role -> [${keys.join(", ")}]`);
  }

  // 2) Create team users (idempotent by email).
  for (const t of TEAM) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, t.email))
      .limit(1);
    if (existing.length > 0) {
      console.log(`• ${t.email} already exists — skipping`);
      continue;
    }
    const [u] = await db
      .insert(users)
      .values({ orgId, name: t.name, email: t.email, passwordHash: hashPassword(t.password) })
      .returning();
    const roleId = roleByName.get(t.role);
    if (u && roleId) await db.insert(userRoles).values({ userId: u.id, roleId });
    console.log(`✓ ${t.name.padEnd(12)} ${t.role.padEnd(6)} ${t.email} / ${t.password}`);
  }
}

main()
  .then(() => sqlClient.end())
  .catch(async (err) => {
    console.error(err);
    await sqlClient.end();
    process.exit(1);
  });
