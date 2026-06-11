import { sql } from "drizzle-orm";
import {
  BASE_UNITS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRole,
} from "@ics/shared";
import { db, sqlClient } from "./client";
import {
  orgs,
  users,
  roles,
  permissions,
  rolePermissions,
  userRoles,
  locations,
  categories,
  units,
  items,
  itemPackLevels,
  movements,
} from "./schema";
import { hashPassword } from "../lib/password";

async function main() {
  const existing = await db.select({ id: orgs.id }).from(orgs).limit(1);
  if (existing.length > 0) {
    console.log("• Database already seeded — skipping.");
    return;
  }

  console.log("Seeding demo org…");

  // --- org -----------------------------------------------------------------
  const [org] = await db.insert(orgs).values({ name: "Demo Org" }).returning();
  if (!org) throw new Error("Failed to create org");

  // --- permissions catalog (global) ---------------------------------------
  await db
    .insert(permissions)
    .values(PERMISSIONS.map((key) => ({ key })))
    .onConflictDoNothing();
  const permRows = await db.select().from(permissions);
  const permByKey = new Map(permRows.map((p) => [p.key, p.id]));

  // --- roles + grants ------------------------------------------------------
  const roleRows = await db
    .insert(roles)
    .values(SYSTEM_ROLES.map((name) => ({ orgId: org.id, name, isSystem: true })))
    .returning();
  const roleByName = new Map(roleRows.map((r) => [r.name as SystemRole, r.id]));

  const grants: { roleId: string; permissionId: string }[] = [];
  for (const role of SYSTEM_ROLES) {
    const grant = ROLE_PERMISSIONS[role];
    const keys = grant === "*" ? PERMISSIONS : grant;
    for (const key of keys) {
      const permissionId = permByKey.get(key);
      const roleId = roleByName.get(role);
      if (permissionId && roleId) grants.push({ roleId, permissionId });
    }
  }
  if (grants.length) await db.insert(rolePermissions).values(grants);

  // --- admin user ----------------------------------------------------------
  const [admin] = await db
    .insert(users)
    .values({
      orgId: org.id,
      name: "Admin",
      email: "admin@demo.local",
      passwordHash: hashPassword("admin123"),
    })
    .returning();
  if (!admin) throw new Error("Failed to create admin user");
  const adminRoleId = roleByName.get("Admin");
  if (adminRoleId) await db.insert(userRoles).values({ userId: admin.id, roleId: adminRoleId });

  // --- units ---------------------------------------------------------------
  const unitRows = await db
    .insert(units)
    .values(BASE_UNITS.map((u) => ({ ...u, orgId: org.id })))
    .returning();
  const unitByCode = new Map(unitRows.map((u) => [u.code, u.id]));
  const ml = unitByCode.get("ml")!;
  const each = unitByCode.get("each")!;
  const bottle = unitByCode.get("bottle")!;
  const caseUnit = unitByCode.get("case")!;

  // --- locations -----------------------------------------------------------
  const locRows = await db
    .insert(locations)
    .values([
      { orgId: org.id, name: "Main Store", type: "store" as const },
      { orgId: org.id, name: "Main Bar", type: "bar" as const },
      { orgId: org.id, name: "Kitchen", type: "kitchen" as const },
    ])
    .returning();
  const locByName = new Map(locRows.map((l) => [l.name, l.id]));
  const mainStore = locByName.get("Main Store")!;

  // --- category ------------------------------------------------------------
  const [spirits] = await db
    .insert(categories)
    .values({ orgId: org.id, name: "Spirits" })
    .returning();

  // --- items ---------------------------------------------------------------
  const itemRows = await db
    .insert(items)
    .values([
      {
        orgId: org.id,
        sku: "GIN-750",
        name: "Gordon's Gin 750ml",
        brand: "Gordon's",
        categoryId: spirits?.id,
        itemType: "bulk_liquid" as const,
        baseUnitId: ml,
        stockUnitId: bottle,
        purchaseUnitId: caseUnit,
        parLevel: "3000",
      },
      {
        orgId: org.id,
        sku: "TONIC-200",
        name: "Tonic Water 200ml",
        itemType: "discrete" as const,
        baseUnitId: each,
        parLevel: "24",
      },
      {
        orgId: org.id,
        sku: "LIME",
        name: "Lime (fresh)",
        itemType: "ingredient" as const,
        baseUnitId: each,
        perishable: true,
        shelfLifeDays: 14,
        parLevel: "50",
      },
    ])
    .returning();
  const itemBySku = new Map(itemRows.map((i) => [i.sku, i.id]));
  const gin = itemBySku.get("GIN-750")!;
  const tonic = itemBySku.get("TONIC-200")!;
  const lime = itemBySku.get("LIME")!;

  // --- pack hierarchy for gin: ml -> bottle (750) -> case (12 bottles) -----
  await db.insert(itemPackLevels).values([
    { orgId: org.id, itemId: gin, level: 0, unitId: ml, qtyInBase: "1" },
    { orgId: org.id, itemId: gin, level: 1, unitId: bottle, qtyInBase: "750" },
    { orgId: org.id, itemId: gin, level: 2, unitId: caseUnit, qtyInBase: "9000" },
  ]);

  // --- opening stock as RECEIPT movements (not stored balances!) -----------
  const now = new Date();
  await db.insert(movements).values([
    {
      orgId: org.id,
      itemId: gin,
      locationId: mainStore,
      baseQty: "7500", // 10 bottles x 750 ml
      movementType: "receipt" as const,
      reasonCode: "opening_balance",
      occurredAt: now,
      actorUserId: admin.id,
    },
    {
      orgId: org.id,
      itemId: tonic,
      locationId: mainStore,
      baseQty: "48",
      movementType: "receipt" as const,
      reasonCode: "opening_balance",
      occurredAt: now,
      actorUserId: admin.id,
    },
    {
      orgId: org.id,
      itemId: lime,
      locationId: mainStore,
      baseQty: "100",
      movementType: "receipt" as const,
      reasonCode: "opening_balance",
      occurredAt: now,
      actorUserId: admin.id,
    },
  ]);

  // --- derive stock_balances from the ledger (the core principle) ----------
  await db.execute(sql`
    INSERT INTO stock_balances (org_id, item_id, location_id, base_qty, updated_at)
    SELECT org_id, item_id, location_id, SUM(base_qty), now()
    FROM movements
    GROUP BY org_id, item_id, location_id
    ON CONFLICT (org_id, item_id, location_id)
    DO UPDATE SET base_qty = EXCLUDED.base_qty, updated_at = now()
  `);

  console.log("✓ Seed complete");
  console.log("  org:        Demo Org");
  console.log("  login:      admin@demo.local / admin123");
  console.log("  items:      GIN-750, TONIC-200, LIME");
  console.log("  movements:  3 opening receipts at Main Store");
}

main()
  .then(() => sqlClient.end())
  .catch(async (err) => {
    console.error(err);
    await sqlClient.end();
    process.exit(1);
  });
