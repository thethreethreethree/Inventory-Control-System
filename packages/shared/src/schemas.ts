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
