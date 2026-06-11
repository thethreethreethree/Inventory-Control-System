import { z } from "zod";
import { MOVEMENT_TYPES } from "./movements";

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

/** A quantity is always expressed in the item's base unit, and may be fractional
 * (e.g. a bottle 0.4 full = 300 ml). Full-unit-only counting is a known hole. */
export const createMovementSchema = z.object({
  itemId: z.string().uuid(),
  locationId: z.string().uuid(),
  baseQty: z.number().finite(), // signed
  movementType: z.enum(MOVEMENT_TYPES),
  reasonCode: z.string().max(50).optional(),
  occurredAt: z.string().datetime().optional(),
  counterpartyUserId: z.string().uuid().optional(),
});
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
