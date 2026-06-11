import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigserial,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Phase-1 (Foundation) + Ledger core. See docs/SYSTEM_DESIGN.md sect. 2.
 * Core law: stock-on-hand is NEVER stored as an editable number — it is derived
 * from `movements` (append-only). `stock_balances` is a rebuildable cache only.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const locationType = pgEnum("location_type", [
  "store",
  "bar",
  "kitchen",
  "room_service",
  "spa",
  "other",
]);
export const unitDimension = pgEnum("unit_dimension", ["volume", "mass", "count"]);
export const itemType = pgEnum("item_type", [
  "bulk_liquid",
  "discrete",
  "ingredient",
  "sold_recipe",
]);
export const movementType = pgEnum("movement_type", [
  "receipt",
  "issue",
  "transfer_in",
  "transfer_out",
  "waste",
  "breakage",
  "comp",
  "return",
  "adjustment",
  "count_correction",
]);
export const transferStatus = pgEnum("transfer_status", [
  "in_transit",
  "received",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// Tenancy & identity
// ---------------------------------------------------------------------------
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    status: userStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_org_email_uniq").on(t.orgId, t.email)],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: varchar("name", { length: 100 }).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("roles_org_name_uniq").on(t.orgId, t.name)],
);

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: varchar("name", { length: 200 }).notNull(),
    type: locationType("type").default("other").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => locations.id),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("locations_org_name_uniq").on(t.orgId, t.name)],
);

// ---------------------------------------------------------------------------
// Item master & units
// ---------------------------------------------------------------------------
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: varchar("name", { length: 200 }).notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
    defaultTolerancePct: numeric("default_tolerance_pct", { precision: 6, scale: 3 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("categories_org_name_uniq").on(t.orgId, t.name)],
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    dimension: unitDimension("dimension").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("units_org_code_uniq").on(t.orgId, t.code)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    sku: varchar("sku", { length: 64 }).notNull(),
    barcode: varchar("barcode", { length: 64 }),
    name: varchar("name", { length: 200 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    categoryId: uuid("category_id").references(() => categories.id),
    itemType: itemType("item_type").notNull(),
    baseUnitId: uuid("base_unit_id")
      .notNull()
      .references(() => units.id),
    stockUnitId: uuid("stock_unit_id").references(() => units.id),
    purchaseUnitId: uuid("purchase_unit_id").references(() => units.id),
    costMethod: varchar("cost_method", { length: 20 }).default("moving_avg").notNull(),
    parLevel: numeric("par_level", { precision: 20, scale: 4 }),
    reorderPoint: numeric("reorder_point", { precision: 20, scale: 4 }),
    reorderQty: numeric("reorder_qty", { precision: 20, scale: 4 }),
    leadTimeDays: integer("lead_time_days"),
    perishable: boolean("perishable").default(false).notNull(),
    shelfLifeDays: integer("shelf_life_days"),
    lotTracked: boolean("lot_tracked").default(false).notNull(),
    defaultLocationId: uuid("default_location_id").references(() => locations.id),
    sellPrice: numeric("sell_price", { precision: 14, scale: 4 }),
    taxRate: numeric("tax_rate", { precision: 6, scale: 4 }),
    tolerancePct: numeric("tolerance_pct", { precision: 6, scale: 3 }),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("items_org_sku_uniq").on(t.orgId, t.sku),
    index("items_org_category_idx").on(t.orgId, t.categoryId),
  ],
);

/** Pack hierarchy: base -> bottle -> case, each expressed in base units. */
export const itemPackLevels = pgTable(
  "item_pack_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    level: integer("level").notNull(), // 0 = base unit, 1 = next pack up, ...
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    qtyInBase: numeric("qty_in_base", { precision: 20, scale: 8 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pack_levels_item_level_uniq").on(t.itemId, t.level)],
);

/** Explicit, date-versioned unit conversions. `itemId` null = global conversion. */
export const unitConversions = pgTable("unit_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id),
  itemId: uuid("item_id").references(() => items.id),
  fromUnitId: uuid("from_unit_id")
    .notNull()
    .references(() => units.id),
  toUnitId: uuid("to_unit_id")
    .notNull()
    .references(() => units.id),
  factor: numeric("factor", { precision: 20, scale: 8 }).notNull(), // 1 from = factor * to
  effectiveDate: timestamp("effective_date", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// The ledger (the spine)
// ---------------------------------------------------------------------------
export const movements = pgTable(
  "movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: bigserial("seq", { mode: "number" }).notNull(), // chain order
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    baseQty: numeric("base_qty", { precision: 20, scale: 4 }).notNull(), // signed, base unit
    movementType: movementType("movement_type").notNull(),
    reasonCode: varchar("reason_code", { length: 50 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).defaultNow().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    counterpartyUserId: uuid("counterparty_user_id").references(() => users.id),
    refType: varchar("ref_type", { length: 40 }), // po | grn | transfer | count | sale
    refId: uuid("ref_id"),
    lotId: uuid("lot_id"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    correctsMovementId: uuid("corrects_movement_id").references(
      (): AnyPgColumn => movements.id,
    ),
    hash: varchar("hash", { length: 64 }), // tamper-evidence chain (optional)
    prevHash: varchar("prev_hash", { length: 64 }),
  },
  (t) => [
    index("movements_item_loc_idx").on(t.orgId, t.itemId, t.locationId),
    index("movements_occurred_idx").on(t.orgId, t.occurredAt),
    index("movements_type_idx").on(t.orgId, t.movementType),
  ],
);

/** Derived cache of on-hand, rebuildable at any time from `movements`. */
export const stockBalances = pgTable(
  "stock_balances",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    baseQty: numeric("base_qty", { precision: 20, scale: 4 }).default("0").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.itemId, t.locationId] })],
);

// ---------------------------------------------------------------------------
// Transfers (the who-released -> who-received handoff)
// ---------------------------------------------------------------------------
// On create: stock leaves source (transfer_out) and the transfer is in_transit.
// On confirm: stock arrives at destination (transfer_in) and status -> received.
// In-transit stock is intentionally at neither location until confirmed.
export const transfers = pgTable("transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id),
  fromLocationId: uuid("from_location_id")
    .notNull()
    .references(() => locations.id),
  toLocationId: uuid("to_location_id")
    .notNull()
    .references(() => locations.id),
  status: transferStatus("status").default("in_transit").notNull(),
  reasonCode: varchar("reason_code", { length: 50 }),
  issuedByUserId: uuid("issued_by_user_id").references(() => users.id),
  receivedByUserId: uuid("received_by_user_id").references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
});

export const transferLines = pgTable(
  "transfer_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => transfers.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    baseQty: numeric("base_qty", { precision: 20, scale: 4 }).notNull(), // positive magnitude
  },
  (t) => [index("transfer_lines_transfer_idx").on(t.transferId)],
);

// ---------------------------------------------------------------------------
// Purchasing & receiving (the 3-way match: PO <-> GRN <-> Invoice)
// ---------------------------------------------------------------------------
export const poStatus = pgEnum("po_status", [
  "draft",
  "approved",
  "sent",
  "partially_received",
  "received",
  "closed",
  "cancelled",
]);
export const grnStatus = pgEnum("grn_status", ["posted", "cancelled"]);
export const invoiceMatchStatus = pgEnum("invoice_match_status", [
  "unmatched",
  "matched",
  "discrepancy",
]);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: varchar("name", { length: 200 }).notNull(),
    terms: varchar("terms", { length: 100 }),
    leadTimeDays: integer("lead_time_days"),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("suppliers_org_name_uniq").on(t.orgId, t.name)],
);

// What we ORDERED.
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    reference: varchar("reference", { length: 60 }), // human PO number
    status: poStatus("status").default("draft").notNull(),
    orderedByUserId: uuid("ordered_by_user_id").references(() => users.id),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).defaultNow().notNull(),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [index("po_org_status_idx").on(t.orgId, t.status)],
);

export const poLines = pgTable(
  "po_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    qtyOrdered: numeric("qty_ordered", { precision: 20, scale: 4 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    orderedBaseQty: numeric("ordered_base_qty", { precision: 20, scale: 4 }).notNull(),
    receivedBaseQty: numeric("received_base_qty", { precision: 20, scale: 4 })
      .default("0")
      .notNull(),
  },
  (t) => [index("po_lines_po_idx").on(t.poId)],
);

// What physically ARRIVED (counted at the door). Posts receipt movements.
export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id),
  poId: uuid("po_id").references(() => purchaseOrders.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  receivedByUserId: uuid("received_by_user_id").references(() => users.id),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  status: grnStatus("status").default("posted").notNull(),
  note: text("note"),
});

export const grnLines = pgTable(
  "grn_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    grnId: uuid("grn_id")
      .notNull()
      .references(() => goodsReceipts.id),
    poLineId: uuid("po_line_id").references(() => poLines.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    qtyReceived: numeric("qty_received", { precision: 20, scale: 4 }).notNull(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    receivedBaseQty: numeric("received_base_qty", { precision: 20, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4 }),
    lotNo: varchar("lot_no", { length: 80 }),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    condition: varchar("condition", { length: 20 }).default("good").notNull(),
  },
  (t) => [index("grn_lines_grn_idx").on(t.grnId)],
);

// What we were BILLED. Matched against PO (ordered) and GRN (received).
export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    poId: uuid("po_id").references(() => purchaseOrders.id),
    invoiceNo: varchar("invoice_no", { length: 80 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }),
    matchStatus: invoiceMatchStatus("match_status").default("unmatched").notNull(),
    matchDetail: jsonb("match_detail").$type<Record<string, unknown>>(),
    attachmentId: uuid("attachment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("invoices_org_supplier_idx").on(t.orgId, t.supplierId)],
);

// ---------------------------------------------------------------------------
// Audit log (who did what in the app — distinct from the ledger)
// ---------------------------------------------------------------------------
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: varchar("ip", { length: 64 }),
    sessionId: varchar("session_id", { length: 128 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_org_time_idx").on(t.orgId, t.occurredAt)],
);
