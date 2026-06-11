import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import type { Permission } from "@ics/shared";
import { db } from "../db/client";
import { auditLog, permissions as permsTable, rolePermissions, userRoles, users } from "../db/schema";
import { httpError } from "./errors";
import { verifyToken } from "./token";

export interface Ctx {
  orgId: string;
  userId: string;
  userName: string;
  permissions: Set<Permission>;
}

declare module "fastify" {
  interface FastifyRequest {
    ctx?: Ctx;
  }
}

// Routes reachable without a token.
const PUBLIC = new Set(["/health", "/auth/login"]);

// Mutating routes -> the permission required to call them. Anything not listed
// requires only a valid session (any authenticated user). GETs are read-only.
const PERMISSION_BY_ROUTE: Record<string, Permission> = {
  "POST /movements": "movement.create",
  "POST /transfers": "transfer.create",
  "POST /transfers/:id/confirm": "transfer.confirm",
  "POST /suppliers": "po.create",
  "POST /purchase-orders": "po.create",
  "POST /purchase-orders/:id/approve": "po.approve",
  "POST /goods-receipts": "grn.confirm",
  "POST /invoices": "po.create",
  "POST /counts": "count.create",
  "POST /counts/:id/lines": "count.create",
  "POST /counts/:id/post": "count.post",
  "POST /adjustments": "adjustment.request",
  "POST /adjustments/:id/approve": "adjustment.approve",
  "POST /adjustments/:id/reject": "adjustment.approve",
  "POST /periods": "period.close",
  "POST /periods/:id/close": "period.close",
  "POST /recipes": "item.create",
  "POST /sales-imports": "movement.create",
  "POST /balances/rebuild": "movement.read",
  "PUT /settings": "user.manage",
  "POST /locations": "user.manage",
  "POST /categories": "item.create",
  "POST /items": "item.create",
};

async function loadCtx(userId: string): Promise<Ctx | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== "active") return null;
  const rows = await db
    .select({ key: permsTable.key })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permsTable, eq(permsTable.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  return {
    orgId: user.orgId,
    userId: user.id,
    userName: user.name,
    permissions: new Set(rows.map((r) => r.key as Permission)),
  };
}

export function setupAuth(app: FastifyInstance) {
  // Authenticate + authorize every request (global hook on the root instance).
  app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return; // CORS preflight
    if (req.url.startsWith("/uploads/")) return; // served images (capability URLs)
    const url = req.routeOptions?.url ?? req.url;
    if (PUBLIC.has(url)) return;

    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? verifyToken<{ userId: string }>(token) : null;
    if (!payload?.userId) {
      return reply.code(401).send({ error: "authentication required" });
    }
    const ctx = await loadCtx(payload.userId);
    if (!ctx) return reply.code(401).send({ error: "invalid or expired session" });
    req.ctx = ctx;

    const need = PERMISSION_BY_ROUTE[`${req.method} ${url}`];
    if (need && !ctx.permissions.has(need)) {
      return reply.code(403).send({ error: `missing permission: ${need}` });
    }
  });

  // Append-only audit trail of every mutation (who did what in the app).
  app.addHook("onResponse", async (req, reply) => {
    if (req.method === "GET" || req.method === "OPTIONS" || !req.ctx) return;
    const url = req.routeOptions?.url ?? req.url;
    try {
      await db.insert(auditLog).values({
        orgId: req.ctx.orgId,
        actorUserId: req.ctx.userId,
        action: `${req.method} ${url}`,
        ip: req.ip,
        after: { status: reply.statusCode },
      });
    } catch {
      // Never let audit logging break a request.
    }
  });
}

export function getCtx(req: FastifyRequest): Ctx {
  if (!req.ctx) throw httpError("authentication required", 401);
  return req.ctx;
}
