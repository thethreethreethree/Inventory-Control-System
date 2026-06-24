/**
 * The ledger vocabulary. Every quantity change is a typed, signed movement.
 * Stock-on-hand is the running SUM of these — it is never stored or edited.
 * Corrections are new compensating movements, never edits. (SYSTEM_DESIGN sect. 1.)
 */
export const MOVEMENT_TYPES = [
  "receipt", // goods received into a location (+)
  "issue", // released/used/sold out of a location (-)
  "transfer_in", // arrival side of an inter-location transfer (+)
  "transfer_out", // departure side of an inter-location transfer (-)
  "waste", // spillage / spoilage (-)
  "breakage", // physical breakage (-)
  "comp", // comped / promotional / internal consumption (-)
  "return", // returned to supplier, or sale reversed (+/-)
  "adjustment", // approved manual correction (+/-)
  "count_correction", // posted variance from a stocktake (+/-)
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Whether a movement type normally adds to or removes from stock. */
export const MOVEMENT_SIGN: Record<MovementType, "+" | "-" | "+/-"> = {
  receipt: "+",
  issue: "-",
  transfer_in: "+",
  transfer_out: "-",
  waste: "-",
  breakage: "-",
  comp: "-",
  return: "+/-",
  adjustment: "+/-",
  count_correction: "+/-",
};

/**
 * Movement types a client may post directly via POST /movements. The caller
 * sends a POSITIVE magnitude; the server derives the signed delta from the type
 * (a caller can never accidentally send +100 for an "issue"). Transfers go
 * through their own endpoint; adjustments/counts arrive in later phases.
 */
export const POSTABLE_MOVEMENT_TYPES = [
  "receipt",
  "issue",
  "waste",
  "breakage",
  "comp",
] as const;
export type PostableMovementType = (typeof POSTABLE_MOVEMENT_TYPES)[number];

/** Sign applied to the posted magnitude, per postable type. */
export const MOVEMENT_DELTA: Record<PostableMovementType, 1 | -1> = {
  receipt: 1,
  issue: -1,
  waste: -1,
  breakage: -1,
  comp: -1,
};
