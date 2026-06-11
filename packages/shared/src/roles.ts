/**
 * Roles & permissions. Access is permission-based, never hardcoded role checks.
 * Separation of duties (approver != requester, receiver != purchaser on the same
 * PO) is enforced at the service layer. (SYSTEM_DESIGN sect. 4.)
 */
export const PERMISSIONS = [
  "item.read",
  "item.create",
  "item.update",
  "movement.read",
  "movement.create", // issue / waste / receipt
  "transfer.create",
  "transfer.confirm",
  "po.create",
  "po.approve",
  "grn.confirm", // receive goods at the door
  "count.create",
  "count.post",
  "adjustment.request",
  "adjustment.approve",
  "period.close",
  "user.manage",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES = [
  "Admin",
  "Purchaser",
  "Receiver",
  "Staff",
  "Auditor",
  "Manager",
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Default permission grants per system role. Admin gets everything. */
export const ROLE_PERMISSIONS: Record<SystemRole, Permission[] | "*"> = {
  Admin: "*",
  Purchaser: ["item.read", "movement.read", "po.create"],
  Receiver: ["item.read", "movement.read", "grn.confirm", "transfer.confirm"],
  // Staff may only perform inventory count ENTRY (create/submit counts).
  // Posting a count for variance still requires a Manager (count.post).
  Staff: ["item.read", "movement.read", "count.create"],
  Auditor: ["item.read", "movement.read", "audit.read", "count.create"],
  Manager: [
    "item.read",
    "movement.read",
    "adjustment.approve",
    "po.approve",
    "count.post",
    "period.close",
  ],
};
