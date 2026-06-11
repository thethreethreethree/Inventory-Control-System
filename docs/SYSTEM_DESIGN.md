# Inventory Control System — System Design (v0.1)

> Foundational model. Governs *how* inventory is recorded so the system is auditable to
> 100% accountability. Read alongside `InventoryControlThinker.md` (the reasoning
> discipline). This is a living document — it changes as the model is validated against
> reality, not before.

---

## 0. Locked decisions

| Decision | Choice | Architectural consequence |
|---|---|---|
| Tenancy | **Single org, multi-tenant-ready** | Every table carries `org_id`; queries scope by it. One org seeded now. Multi-tenant later = config, not rewrite. |
| Domain | **F&B / bar-first, extensible** | Recipes, pour specs, partial-bottle counts, ml/oz units are first-class. `item_type` discriminator keeps packaged/retail/supplies on the same core. |
| Consumption capture | **Hybrid: POS sales + manual** | Pluggable sales-ingestion boundary explodes sales → recipes → depletion movements. Manual entry only for waste/transfers/counts. |
| Platform | **Web + mobile/tablet counts** | Web for admin/purchasing/reports; offline-capable PWA count mode with barcode scan for the floor. |

Standalone product — **not** tied to WAVIVI (the WAVIVI assets in the workspace are unrelated).

---

## 1. The one architectural law

**Stock-on-hand is never stored or edited. It is derived from an append-only ledger of movements.**

- Every quantity change is an immutable **Movement** (item, signed qty, base unit, location,
  type, reason, timestamp, actor, counterparty, references).
- Corrections are **new compensating movements**, never edits or deletes. History is permanent.
- Movements balance like double-entry: a transfer is `-X` at source and `+X` at destination
  in **one atomic transaction**. Nothing is created/destroyed without a typed reason.
- Stock balance = `SUM(base_qty)` over movements per `(item, location)`; cached for speed,
  always rebuildable from the ledger.

Consequence: every inventory "hole" has exactly two possible fates — an **explicit typed
movement** (waste/comp/breakage, i.e. accounted) or **variance surfaced at the next count**
(flagged and attributed). It can never silently vanish.

---

## 2. Data model (relational / PostgreSQL)

Every table has `org_id` (tenant key). `created_at`/`updated_at` on all; `*_by` user FKs where actions occur.

### Tenancy, identity & access
- **orgs**(id, name, settings_json)
- **users**(id, org_id, name, email, password_hash, status)
- **roles**(id, org_id, name, is_system) — Admin, Purchaser, Receiver, Staff, Auditor, Manager
- **permissions**(id, key) — e.g. `po.create`, `grn.confirm`, `adjustment.approve`, `count.post`
- **role_permissions**(role_id, permission_id) · **user_roles**(user_id, role_id)
- **locations**(id, org_id, name, type[store|bar|kitchen|room_service|other], parent_id, active)

> Access is **permission-based**, never hardcoded role checks. Separation-of-duties rules
> (e.g. approver ≠ requester, receiver ≠ purchaser on the same PO) are enforced at the
> service layer, not just the UI.

### Item master & units
- **categories**(id, org_id, name, parent_id, default_tolerance_pct)
- **units**(id, org_id, code[ml|g|each|bottle|case…], name, dimension[volume|mass|count])
- **unit_conversions**(id, org_id, item_id?, from_unit, to_unit, factor, effective_date)
  — item-specific (1 bottle = 750 ml) and global (1 L = 1000 ml); versioned by date.
- **items**(id, org_id, sku, barcode, name, brand, category_id,
  item_type[bulk_liquid|discrete|ingredient|sold_recipe],
  base_unit_id, stock_unit_id, purchase_unit_id, cost_method[moving_avg],
  par_level, reorder_point, reorder_qty, lead_time_days,
  perishable, shelf_life_days, lot_tracked, default_location_id,
  sell_price, tax_rate, tolerance_pct, status, image_url)
- **item_suppliers**(item_id, supplier_id, supplier_sku, pack_config_json, last_cost)
- **item_pack_levels**(item_id, level, unit_id, qty_in_base) — case→bottle→ml hierarchy

### Suppliers & purchasing (3-way match)
- **suppliers**(id, org_id, name, terms, lead_time_days, contact, active)
- **purchase_orders**(id, org_id, supplier_id, status[draft|approved|sent|partially_received|received|closed], ordered_by, approved_by, ordered_at, expected_at)
- **po_lines**(id, po_id, item_id, qty_ordered, unit_id, unit_cost)
- **goods_receipts** (GRN)(id, org_id, po_id?, received_by, received_at, location_id, status)
- **grn_lines**(id, grn_id, item_id, qty_received, unit_id, lot_no?, expiry_date?, condition)
- **supplier_invoices**(id, org_id, supplier_id, po_id?, invoice_no, amount, attachment_id, match_status[matched|discrepancy])

> 3-way match = PO (ordered) ↔ GRN (counted at the door, by a person) ↔ Invoice (billed).
> Discrepancies are surfaced, not silently absorbed.

### The ledger (the spine)
- **movements**(id, org_id, item_id, location_id, base_qty[signed], occurred_at, posted_at,
  movement_type[receipt|issue|transfer_in|transfer_out|waste|breakage|comp|return|adjustment|count_correction],
  reason_code, actor_user_id, counterparty_user_id?, ref_type, ref_id,
  lot_id?, unit_cost?, corrects_movement_id?, hash, prev_hash)
  — **append-only**; `hash`/`prev_hash` chain for tamper-evidence.
- **stock_balances**(org_id, item_id, location_id, base_qty, updated_at) — derived cache, rebuildable.
- **transfers**(id, org_id, from_location, to_location, issued_by, received_by?, status[in_transit|received|cancelled], issued_at, received_at?)
- **transfer_lines**(transfer_id, item_id, base_qty, unit_id)
  — posts a `transfer_out` + `transfer_in` pair atomically; `in_transit` (sent, not yet
  receiver-confirmed) is a flagged state, not a hole.

### Recipes & sales ingestion (hybrid depletion)
- **recipes**(id, org_id, sold_item_id, name, version, yield_qty, active)
- **recipe_components**(recipe_id, component_item_id, base_qty, unit_id)
- **sales_imports**(id, org_id, source[pos|manual|csv], imported_by, imported_at, period_id, status)
- **sales_lines**(id, sales_import_id, recipe_id, qty_sold, sold_at, location_id)
  — depletion engine explodes each into `issue` movements via the recipe.
- **POS adapter** = interface, not a table. Ships with CSV/manual import; real POS later.
- **yield tracking**: theoretical pours/bottle vs. actual exposes over-pour.

### Counts / stocktake
- **stock_counts**(id, org_id, location_id, scope[daily_spot|weekly|monthly_full], blind, status[open|counting|review|approved|posted|locked], started_by, approved_by)
- **count_lines**(id, count_id, item_id, counted_base_qty, expected_base_qty?[hidden if blind], variance_base, variance_value, recount_qty?, note)
  — partial units allowed (e.g. 2 full + 1 at 0.4). On approval, variances post as
  `count_correction` movements (via approval if beyond tolerance).

### Adjustments, approvals & periods
- **adjustments**(id, org_id, item_id, location_id, base_qty, reason, requested_by, status[pending|approved|rejected], reviewed_by, ref_count_id?)
- **approval_requests**(id, org_id, entity_type[adjustment|po|void|item_change|price_change], entity_id, requested_by, approver_id, status, reason, decided_at)
  — generic; **approver ≠ requester** enforced.
- **periods**(id, org_id, type[daily|weekly|monthly], start, end, status[open|closed|locked], closed_by, closed_at)
  — locking blocks backdated entries; later corrections go to the open period.

### Attachments & audit
- **attachments**(id, org_id, entity_type, entity_id, file_url, sha256, uploaded_by) — receipts/invoices/photos, hashed.
- **audit_log**(id, org_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, ip, session_id, occurred_at)
  — every app action (incl. logins, approvals, sensitive reads). Distinct from the ledger:
  the ledger is *what changed*; the audit log is *who did what in the app*.

---

## 3. Application modules

1. Item Master & Catalog
2. Units & Conversions
3. Suppliers & Purchasing (PO → GRN → Invoice, 3-way match)
4. **Ledger / Stock engine** (movements, balances, atomic transfers) — the core
5. Recipes & Menu mapping
6. Sales / POS ingestion (hybrid depletion engine)
7. Counts & Stocktake (daily/weekly/monthly; blind counts; mobile PWA + barcode)
8. Adjustments & Approval workflow (separation of duties)
9. Reconciliation & Variance reporting (theoretical vs. actual)
10. Periods & Close/Lock
11. Users, Roles & Permissions
12. Audit log & Attachments
13. Alerts / Notifications & Dashboards / Reports

---

## 4. Roles & separation of duties

| Role | Can | Cannot |
|---|---|---|
| **Admin** | Config, item master, user mgmt, final approvals | Rewrite history (edits post as logged compensating entries) |
| **Purchaser** | Create POs, manage suppliers | Receive or approve their own PO |
| **Receiver** | Confirm goods at the door (GRN) | Create the PO they receive |
| **Staff / Operator** | Record issues, usage, waste; key counts | Approve adjustments; edit posted movements |
| **Auditor** | Read everything, reconcile, sign off variance | Edit transactions |
| **Manager / Approver** | Approve adjustments, voids, count variances | Approve their own request |

---

## 5. Audit cadences (all the same reconciliation, different scope)

Reconciliation = **theoretical (from ledger) vs. actual (physical count) → variance, attributed.**
- **Daily** — high-velocity/high-risk spot counts (open bar bottles), shift handover, today's variance.
- **Weekly** — fuller category counts, supplier reconciliation, waste review, par-level review.
- **Monthly** — full physical inventory, period close (valuation, COGS, shrinkage %), sign-off, **lock period**.

Blind counts + recount tolerance prevent counting-to-match-expected bias.

---

## 6. Inventory-holes catalogue (what the model must defeat)

| # | Hole | Closed by |
|---|---|---|
| 1 | Editable "stock on hand" | Derived from append-only ledger |
| 2 | Partial/open bottles uncounted | Fractional base-unit on-hand + partial-count entry |
| 3 | Unit conversion errors | Explicit, versioned conversions |
| 4 | Spillage/breakage/waste read as theft | Typed waste/breakage movements + photo |
| 5 | Comps/staff drinks unaccounted | Typed comp/internal-use movement |
| 6 | Receiving short-shipment | 3-way match, counted at the door |
| 7 | Transfers "disappear" between depts | Dual-signoff transfers; in-transit flagged |
| 8 | Released "into the void" | Receiver confirmation required |
| 9 | Over-pour / yield loss | Theoretical-vs-actual yield from recipes |
| 10 | Theft / silent shrinkage | Surfaces as variance; must be explained |
| 11 | "Correcting" a count to hide a gap | Approval workflow, approver ≠ requester |
| 12 | Backdated / out-of-sequence entries | Period locking; immutable timestamps |
| 13 | Returns/voids not added back | Compensating movements, not deletions |
| 14 | Duplicate / ghost SKUs | Single item master + barcode uniqueness |
| 15 | Perishable spoilage/expiry | Lot/batch + FIFO/FEFO + expiry tracking |
| 16 | History edited after the fact | Append-only ledger + audit log |
| 17 | One person controls the whole chain | Separation of duties via permissions |
| 18 | Counting bias | Blind counts + recount tolerance |

---

## 7. Recommended stack (open to change — one remaining decision)

| Layer | Recommendation | Why |
|---|---|---|
| Database | **PostgreSQL** | Relational integrity + transactions are non-negotiable for a double-entry ledger. |
| Backend | **TypeScript (Node)** typed API | One language across web + mobile; strong typing for money/units. |
| Web/admin | **React** | Reports, purchasing, config. |
| Floor counts | **PWA** (offline) + camera **barcode** | Counts/receiving on a phone/tablet, offline-tolerant. |
| Auth | Permission-based + audit middleware | Enforces separation of duties + logs every action. |

(Python/Django or a desktop wrapper are viable alternatives — flag before scaffolding.)

---

## 8. Suggested build phases

1. **Foundation** — orgs/users/roles/permissions, locations, item master, units/conversions.
2. **Ledger core** — movements, derived balances, atomic transfers, audit log. *(Everything depends on this.)*
3. **Purchasing** — PO → GRN → Invoice 3-way match, receiving as a count event.
4. **Counts & reconciliation** — stocktake (blind), variance, adjustments + approvals, periods/lock.
5. **Recipes & sales ingestion** — recipes, CSV/manual sales import, hybrid depletion, yield.
6. **Reporting & alerts** — dashboards, variance/shrinkage, par/reorder, expiry, in-transit.
7. **POS integration & polish** — real POS adapter, mobile barcode flow hardening.
