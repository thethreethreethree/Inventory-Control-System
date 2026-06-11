CREATE TYPE "public"."transfer_status" AS ENUM('in_transit', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"base_qty" numeric(20, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"status" "transfer_status" DEFAULT 'in_transit' NOT NULL,
	"reason_code" varchar(50),
	"issued_by_user_id" uuid,
	"received_by_user_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfer_lines_transfer_idx" ON "transfer_lines" USING btree ("transfer_id");