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
