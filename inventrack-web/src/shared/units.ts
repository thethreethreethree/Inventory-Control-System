/**
 * Units of measure. Stock is always reconciled in an item's BASE unit.
 * Conversions (case -> bottle -> ml) are explicit data (unit_conversions /
 * item_pack_levels), never hardcoded — see docs/SYSTEM_DESIGN.md sect. 2 & D.
 */
export const UNIT_DIMENSIONS = ["volume", "mass", "count"] as const;
export type UnitDimension = (typeof UNIT_DIMENSIONS)[number];

/** Seeded base units. `code` is unique per org. */
export const BASE_UNITS: ReadonlyArray<{
  code: string;
  name: string;
  dimension: UnitDimension;
}> = [
  { code: "ml", name: "Millilitre", dimension: "volume" },
  { code: "g", name: "Gram", dimension: "mass" },
  { code: "each", name: "Each", dimension: "count" },
  { code: "bottle", name: "Bottle", dimension: "count" },
  { code: "case", name: "Case", dimension: "count" },
];
