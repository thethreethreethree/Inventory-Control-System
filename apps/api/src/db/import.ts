import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { PERMISSIONS, ROLE_PERMISSIONS, SYSTEM_ROLES, type SystemRole } from "@ics/shared";
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
  unitConversions,
  items,
  itemPackLevels,
  movements,
} from "./schema";
import { hashPassword } from "../lib/password";

// --- units to create (base + larger display units) -------------------------
const UNITS = [
  { code: "ml", name: "Millilitre", dimension: "volume" as const },
  { code: "L", name: "Litre", dimension: "volume" as const },
  { code: "g", name: "Gram", dimension: "mass" as const },
  { code: "kg", name: "Kilogram", dimension: "mass" as const },
  { code: "each", name: "Each", dimension: "count" as const },
  { code: "bottle", name: "Bottle", dimension: "count" as const },
  { code: "case", name: "Case", dimension: "count" as const },
];

interface Row {
  name: string;
  category: string;
  uom: string;
  minOnHand: string;
}

function readCsv(): Row[] {
  const here = dirname(fileURLToPath(import.meta.url)); // apps/api/src/db
  const path = resolve(here, "../../../../data/hub-and-sky-bar-inventory.csv");
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  lines.shift(); // header
  return lines.map((line) => {
    const cols = line.split(",");
    return {
      name: (cols[0] ?? "").trim(),
      category: (cols[1] ?? "").trim(),
      uom: (cols[2] ?? "").trim(),
      minOnHand: (cols[3] ?? "").trim(),
    };
  });
}

/** Bottle size in ml parsed from a name like "ABSOLUT VODKA (1000ml)". */
function bottleSizeFromName(name: string): number | null {
  const m = name.match(/\((\d+(?:\.\d+)?)\s*ml\)/i);
  return m ? Number(m[1]) : null;
}

type BaseUnit = "ml" | "g" | "each";

function classify(uom: string): { base: BaseUnit; itemType: string } {
  const u = uom.trim().toUpperCase();
  if (u === "L" || u === "ML") return { base: "ml", itemType: "bulk_liquid" };
  if (u === "KG" || u === "GR" || u === "G") return { base: "g", itemType: "ingredient" };
  return { base: "each", itemType: "discrete" };
}

/** Parse the free-text MinOnHand into a quantity in the item's BASE unit. */
function parseQty(
  raw: string,
  base: BaseUnit,
  bottleSizeMl: number | null,
): { qty: number; note?: string } {
  const s = raw.trim().toLowerCase();
  if (!s) return { qty: 0 };
  if (!/\d/.test(s)) return { qty: 0, note: `non-numeric ("${raw}")` };

  if (base === "each") {
    const nums = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    return { qty: nums.reduce((a, b) => a + b, 0) };
  }

  if (base === "ml") {
    let ml = 0;
    let note: string | undefined;
    const bot = s.match(/(\d+(?:\.\d+)?)\s*bot/);
    if (bot) {
      if (!bottleSizeMl) note = "assumed 750ml bottle";
      ml += Number(bot[1]) * (bottleSizeMl ?? 750);
    }
    for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*ml/g)) ml += Number(m[1]);
    for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*l\b/g)) ml += Number(m[1]) * 1000;
    return { qty: ml, note };
  }

  // mass -> grams
  let g = 0;
  let note: string | undefined;
  const kg = s.match(/(\d+(?:\.\d+)?)\s*(kgram|kg|kl)/);
  if (kg) {
    const n = Number(kg[1]);
    if (kg[2]?.includes("kgram") && n >= 50) {
      g += n; // "1168 Kgrams" reads as grams
      note = `"${raw}" read as grams`;
    } else {
      g += n * 1000;
    }
  } else {
    const gram = s.match(/(\d+(?:\.\d+)?)\s*gram/);
    const bare = s.match(/(\d+(?:\.\d+)?)/);
    g += gram ? Number(gram[1]) : bare ? Number(bare[1]) : 0;
  }
  return { qty: g, note };
}

function makeSku(name: string, used: Set<string>): string {
  let base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  if (!base) base = "ITEM";
  let sku = base;
  let i = 2;
  while (used.has(sku)) sku = `${base}-${i++}`;
  used.add(sku);
  return sku;
}

async function main() {
  const existing = await db
    .select({ id: orgs.id })
    .from(orgs)
    .where(sql`name = 'Hub & Sky Bar'`)
    .limit(1);
  if (existing.length > 0) {
    console.log("• 'Hub & Sky Bar' org already exists — skipping import.");
    return;
  }

  const rows = readCsv();
  console.log(`Importing ${rows.length} items from CSV…`);

  // --- org ---
  const [org] = await db.insert(orgs).values({ name: "Hub & Sky Bar" }).returning();
  if (!org) throw new Error("failed to create org");
  const orgId = org.id;

  // --- permissions + roles + grants ---
  await db
    .insert(permissions)
    .values(PERMISSIONS.map((key) => ({ key })))
    .onConflictDoNothing();
  const permRows = await db.select().from(permissions);
  const permByKey = new Map(permRows.map((p) => [p.key, p.id]));
  const roleRows = await db
    .insert(roles)
    .values(SYSTEM_ROLES.map((name) => ({ orgId: orgId, name, isSystem: true })))
    .returning();
  const roleByName = new Map(roleRows.map((r) => [r.name as SystemRole, r.id]));
  const grants: { roleId: string; permissionId: string }[] = [];
  for (const role of SYSTEM_ROLES) {
    const grant = ROLE_PERMISSIONS[role];
    for (const key of grant === "*" ? PERMISSIONS : grant) {
      const permissionId = permByKey.get(key);
      const roleId = roleByName.get(role);
      if (permissionId && roleId) grants.push({ roleId, permissionId });
    }
  }
  if (grants.length) await db.insert(rolePermissions).values(grants);

  // --- users (admin / manager / purchaser) ---
  async function makeUser(name: string, email: string, pw: string, role: SystemRole) {
    const [u] = await db
      .insert(users)
      .values({ orgId: orgId, name, email, passwordHash: hashPassword(pw) })
      .returning();
    const roleId = roleByName.get(role);
    if (u && roleId) await db.insert(userRoles).values({ userId: u.id, roleId });
    return u;
  }
  const admin = await makeUser("Admin", "admin@demo.local", "admin123", "Admin");
  await makeUser("Manager", "manager@demo.local", "manager123", "Manager");
  await makeUser("Purchaser", "purchaser@demo.local", "purchaser123", "Purchaser");
  if (!admin) throw new Error("failed to create admin");

  // --- units + global conversions ---
  const unitRows = await db
    .insert(units)
    .values(UNITS.map((u) => ({ ...u, orgId: orgId })))
    .returning();
  const unitByCode = new Map(unitRows.map((u) => [u.code, u.id]));
  const uid = (code: string) => unitByCode.get(code)!;
  await db.insert(unitConversions).values([
    { orgId: orgId, fromUnitId: uid("L"), toUnitId: uid("ml"), factor: "1000" },
    { orgId: orgId, fromUnitId: uid("kg"), toUnitId: uid("g"), factor: "1000" },
  ]);

  // --- locations ---
  // The three real venues. Opening stock loads into HUB; transfer to the others.
  const locRows = await db
    .insert(locations)
    .values([
      { orgId: orgId, name: "HUB", type: "bar" as const },
      { orgId: orgId, name: "Frendz Saboria", type: "bar" as const },
      { orgId: orgId, name: "Twinbeach", type: "bar" as const },
    ])
    .returning();
  const mainStore = locRows.find((l) => l.name === "HUB")!.id;

  // --- categories ---
  const catNames = [...new Set(rows.map((r) => r.category || "Uncategorised"))];
  const catRows = await db
    .insert(categories)
    .values(catNames.map((name) => ({ orgId: orgId, name })))
    .returning();
  const catByName = new Map(catRows.map((c) => [c.name, c.id]));

  // --- items + opening stock ---
  const usedSku = new Set<string>();
  const notes: string[] = [];
  let withStock = 0;
  const openingMovements: (typeof movements.$inferInsert)[] = [];
  const now = new Date();

  for (const row of rows) {
    if (!row.name) continue;
    const { base, itemType } = classify(row.uom);
    const bottleSizeMl = base === "ml" ? bottleSizeFromName(row.name) : null;
    const parsed = parseQty(row.minOnHand, base, bottleSizeMl);
    if (parsed.note) notes.push(`${row.name}: ${parsed.note}`);

    const stockUnitId =
      base === "ml" ? (bottleSizeMl ? uid("bottle") : uid("ml")) : base === "g" ? uid("kg") : uid("each");

    const [item] = await db
      .insert(items)
      .values({
        orgId: orgId,
        sku: makeSku(row.name, usedSku),
        name: row.name,
        categoryId: catByName.get(row.category || "Uncategorised"),
        itemType: itemType as never,
        baseUnitId: uid(base),
        stockUnitId,
        perishable: row.category.toLowerCase() === "fruits",
      })
      .returning();
    if (!item) throw new Error(`failed to create item ${row.name}`);

    // pack levels
    const packs: (typeof itemPackLevels.$inferInsert)[] = [];
    if (base === "ml") {
      packs.push({ orgId: orgId, itemId: item.id, level: 0, unitId: uid("ml"), qtyInBase: "1" });
      if (bottleSizeMl)
        packs.push({
          orgId: orgId,
          itemId: item.id,
          level: 1,
          unitId: uid("bottle"),
          qtyInBase: String(bottleSizeMl),
        });
    } else if (base === "g") {
      packs.push({ orgId: orgId, itemId: item.id, level: 0, unitId: uid("g"), qtyInBase: "1" });
      packs.push({ orgId: orgId, itemId: item.id, level: 1, unitId: uid("kg"), qtyInBase: "1000" });
    } else {
      packs.push({ orgId: orgId, itemId: item.id, level: 0, unitId: uid("each"), qtyInBase: "1" });
    }
    await db.insert(itemPackLevels).values(packs);

    if (parsed.qty > 0) {
      withStock++;
      openingMovements.push({
        orgId: orgId,
        itemId: item.id,
        locationId: mainStore,
        baseQty: String(parsed.qty),
        movementType: "receipt",
        reasonCode: "opening_balance",
        occurredAt: now,
        actorUserId: admin.id,
      });
    }
  }

  if (openingMovements.length) await db.insert(movements).values(openingMovements);

  // derive balances from the ledger
  await db.execute(sql`
    INSERT INTO stock_balances (org_id, item_id, location_id, base_qty, updated_at)
    SELECT org_id, item_id, location_id, SUM(base_qty), now()
    FROM movements
    GROUP BY org_id, item_id, location_id
    ON CONFLICT (org_id, item_id, location_id)
    DO UPDATE SET base_qty = EXCLUDED.base_qty, updated_at = now()
  `);

  console.log("✓ Import complete");
  console.log(`  org:        Hub & Sky Bar`);
  console.log(`  items:      ${usedSku.size}`);
  console.log(`  with stock: ${withStock} (opening receipts at HUB)`);
  console.log(`  users:      admin@demo.local/admin123, manager@demo.local/manager123,`);
  console.log(`              purchaser@demo.local/purchaser123`);
  if (notes.length) {
    console.log(`  notes (${notes.length} parsing assumptions):`);
    for (const n of notes) console.log(`    - ${n}`);
  }
}

main()
  .then(() => sqlClient.end())
  .catch(async (err) => {
    console.error(err);
    await sqlClient.end();
    process.exit(1);
  });
