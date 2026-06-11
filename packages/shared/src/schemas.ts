import { z } from "zod";
import { POSTABLE_MOVEMENT_TYPES } from "./movements";

/** Validation contracts shared by API and web. */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createItemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  itemType: z.enum(["bulk_liquid", "discrete", "ingredient", "sold_recipe"]),
  baseUnitCode: z.string().min(1),
  brand: z.string().max(120).optional(),
  barcode: z.string().max(64).optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

/**
 * Record a stock movement. `qty` is a POSITIVE magnitude in the item's base
 * unit and may be fractional (a bottle 0.4 full = 300 ml). The server derives
 * the signed delta from `movementType`. Full-unit-only counting is a known hole,
 * so fractional quantities are first-class.
 */
export const recordMovementSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  qty: z.number().positive(),
  movementType: z.enum(POSTABLE_MOVEMENT_TYPES),
  reasonCode: z.string().max(50).optional(),
  occurredAt: z.string().datetime().optional(),
  actorUserId: z.string().uuid().optional(),
  counterpartyUserId: z.string().uuid().optional(),
});
export type RecordMovementInput = z.infer<typeof recordMovementSchema>;

/**
 * Create an inter-location transfer. On creation the stock leaves the source
 * (transfer_out) and the transfer sits `in_transit` until the receiver confirms
 * — modelling real in-transit stock and the who-released -> who-received handoff.
 */
export const createTransferSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  reasonCode: z.string().max(50).optional(),
  issuedByUserId: z.string().uuid().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().positive(),
      }),
    )
    .min(1),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const confirmTransferSchema = z.object({
  receivedByUserId: z.string().uuid().optional(),
});
export type ConfirmTransferInput = z.infer<typeof confirmTransferSchema>;

// --- Purchasing & receiving (PO -> GRN -> Invoice 3-way match) --------------

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  terms: z.string().max(100).optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

/** Quantities are in the line's `unitCode` (e.g. "case"); the server converts
 * to base units via the item's pack hierarchy. */
export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  reference: z.string().max(60).optional(),
  expectedAt: z.string().datetime().optional(),
  orderedByUserId: z.string().uuid().optional(),
  note: z.string().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qtyOrdered: z.number().positive(),
        unitCode: z.string().min(1),
        unitCost: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const approvePurchaseOrderSchema = z.object({
  approvedByUserId: z.string().uuid().optional(),
});
export type ApprovePurchaseOrderInput = z.infer<typeof approvePurchaseOrderSchema>;

/** Goods received at the door — counted by a person. Posts receipt movements. */
export const receiveGoodsSchema = z.object({
  poId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  receivedByUserId: z.string().uuid().optional(),
  note: z.string().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        poLineId: z.string().uuid().optional(),
        qtyReceived: z.number().positive(),
        unitCode: z.string().min(1),
        unitCost: z.number().nonnegative().optional(),
        lotNo: z.string().max(80).optional(),
        expiryDate: z.string().datetime().optional(),
        condition: z.string().max(20).optional(),
      }),
    )
    .min(1),
});
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;

export const recordInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  poId: z.string().uuid().optional(),
  invoiceNo: z.string().min(1).max(80),
  amount: z.number().nonnegative(),
  invoiceDate: z.string().datetime().optional(),
});
export type RecordInvoiceInput = z.infer<typeof recordInvoiceSchema>;

// --- Counts, adjustments & periods (audit / reconciliation) -----------------

export const createCountSchema = z.object({
  locationId: z.string().uuid(),
  scope: z.enum(["daily_spot", "weekly", "monthly_full"]).optional(),
  blind: z.boolean().optional(),
  startedByUserId: z.string().uuid().optional(),
  note: z.string().optional(),
});
export type CreateCountInput = z.infer<typeof createCountSchema>;

export const submitCountLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        countedQty: z.number().nonnegative(), // a counted zero is valid
        unitCode: z.string().min(1),
      }),
    )
    .min(1),
});
export type SubmitCountLinesInput = z.infer<typeof submitCountLinesSchema>;

export const postCountSchema = z.object({
  postedByUserId: z.string().uuid().optional(),
});

export const createAdjustmentSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  baseQtyDelta: z.number().refine((v) => v !== 0, "delta must be non-zero"),
  reason: z.string().min(1).max(50),
  requestedByUserId: z.string().uuid().optional(),
  note: z.string().optional(),
});
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

export const reviewAdjustmentSchema = z.object({
  reviewedByUserId: z.string().uuid().optional(),
  note: z.string().optional(),
});

export const createPeriodSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});
export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

export const closePeriodSchema = z.object({
  closedByUserId: z.string().uuid().optional(),
  lock: z.boolean().optional(),
});

// --- Recipes & sales ingestion (hybrid depletion) ---------------------------

export const createRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  soldItemId: z.string().uuid().optional(),
  yieldQty: z.number().positive().optional(),
  components: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qty: z.number().positive(),
        unitCode: z.string().min(1),
      }),
    )
    .min(1),
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const ingestSalesSchema = z.object({
  source: z.enum(["pos", "csv", "manual"]).optional(),
  locationId: z.string().uuid(),
  importedByUserId: z.string().uuid().optional(),
  reference: z.string().max(60).optional(),
  lines: z
    .array(
      z.object({
        recipeId: z.string().uuid(),
        qtySold: z.number().positive(),
        soldAt: z.string().datetime().optional(),
      }),
    )
    .min(1),
});
export type IngestSalesInput = z.infer<typeof ingestSalesSchema>;
