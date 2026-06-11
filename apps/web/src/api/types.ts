// Response shapes from the API. Numeric DB columns arrive as strings.

export interface Balance {
  sku: string;
  item: string;
  location: string;
  unit: string;
  on_hand: string;
}
export interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  itemType: string;
  status: string;
  category?: string | null;
  unit?: string | null;
  on_hand?: string | null;
}
export interface Location {
  id: string;
  name: string;
  type: string;
  active: boolean;
}
export interface User {
  id: string;
  name: string;
  email: string;
  status: string;
}
export interface Movement {
  id: string;
  seq: number;
  item: string;
  location: string;
  baseQty: string;
  type: string;
  reason: string | null;
  occurredAt: string;
}
export interface Transfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  status: string;
  reasonCode: string | null;
  issuedByUserId: string | null;
  receivedByUserId: string | null;
  issuedAt: string;
  receivedAt: string | null;
}
export interface Supplier {
  id: string;
  name: string;
  terms: string | null;
  leadTimeDays: number | null;
  contactEmail: string | null;
  active: boolean;
}
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  reference: string | null;
  status: string;
  orderedByUserId: string | null;
  approvedByUserId: string | null;
  orderedAt: string;
}
export interface POLine {
  id: string;
  itemId: string;
  qtyOrdered: string;
  unitId: string;
  unitCost: string | null;
  orderedBaseQty: string;
  receivedBaseQty: string;
}
export interface Invoice {
  id: string;
  supplierId: string;
  poId: string | null;
  invoiceNo: string;
  amount: string;
  matchStatus: string;
  matchDetail: Record<string, number> | null;
  attachmentId?: string | null;
  attachmentUrl?: string | null;
}
export interface Count {
  id: string;
  locationId: string;
  scope: string;
  blind: boolean;
  status: string;
  startedAt: string;
  postedAt: string | null;
}
export interface CountLine {
  id: string;
  itemId: string;
  countedBaseQty: string;
  expectedBaseQty: string | null;
  varianceBase: string | null;
  withinTolerance: boolean | null;
  adjustmentId: string | null;
}
export interface Adjustment {
  id: string;
  itemId: string;
  locationId: string;
  baseQtyDelta: string;
  reason: string;
  refType: string | null;
  status: string;
  requestedByUserId: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
}
export interface Period {
  id: string;
  type: string;
  startsAt: string;
  endsAt: string;
  status: string;
}
export interface Recipe {
  id: string;
  name: string;
  soldItemId: string | null;
  yieldQty: string;
  active: boolean;
}
export interface RecipeYield {
  recipe: string;
  components: {
    item: string | null;
    perServingBase: number;
    stockUnit: string | null;
    servingsPerStockUnit: number | null;
  }[];
}
export interface SalesImport {
  id: string;
  source: string;
  locationId: string;
  reference: string | null;
  importedAt: string;
}
