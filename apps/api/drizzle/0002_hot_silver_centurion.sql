CREATE TYPE "public"."grn_status" AS ENUM('posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_match_status" AS ENUM('unmatched', 'matched', 'discrepancy');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('draft', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"po_id" uuid,
	"supplier_id" uuid,
	"location_id" uuid NOT NULL,
	"received_by_user_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "grn_status" DEFAULT 'posted' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "grn_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"grn_id" uuid NOT NULL,
	"po_line_id" uuid,
	"item_id" uuid NOT NULL,
	"qty_received" numeric(20, 4) NOT NULL,
	"unit_id" uuid NOT NULL,
	"received_base_qty" numeric(20, 4) NOT NULL,
	"unit_cost" numeric(14, 4),
	"lot_no" varchar(80),
	"expiry_date" timestamp with time zone,
	"condition" varchar(20) DEFAULT 'good' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty_ordered" numeric(20, 4) NOT NULL,
	"unit_id" uuid NOT NULL,
	"unit_cost" numeric(14, 4),
	"ordered_base_qty" numeric(20, 4) NOT NULL,
	"received_base_qty" numeric(20, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"reference" varchar(60),
	"status" "po_status" DEFAULT 'draft' NOT NULL,
	"ordered_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"po_id" uuid,
	"invoice_no" varchar(80) NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"invoice_date" timestamp with time zone,
	"match_status" "invoice_match_status" DEFAULT 'unmatched' NOT NULL,
	"match_detail" jsonb,
	"attachment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"terms" varchar(100),
	"lead_time_days" integer,
	"contact_email" varchar(320),
	"contact_phone" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_grn_id_goods_receipts_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_po_line_id_po_lines_id_fk" FOREIGN KEY ("po_line_id") REFERENCES "public"."po_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_ordered_by_user_id_users_id_fk" FOREIGN KEY ("ordered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grn_lines_grn_idx" ON "grn_lines" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX "po_lines_po_idx" ON "po_lines" USING btree ("po_id");--> statement-breakpoint
CREATE INDEX "po_org_status_idx" ON "purchase_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "invoices_org_supplier_idx" ON "supplier_invoices" USING btree ("org_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_org_name_uniq" ON "suppliers" USING btree ("org_id","name");