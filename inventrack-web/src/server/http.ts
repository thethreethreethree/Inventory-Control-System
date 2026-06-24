import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { ZodSchema } from "zod";
import type { Permission } from "@ics/shared";
import { db } from "./db/client";
import {
  auditLog,
  permissions as permsTable,
  rolePermissions,
  userRoles,
  users,
} from "./db/schema";
import { verifyToken } from "./lib/token";

/**
 * Request plumbing for the Next.js route handlers — the equivalent of the
 * Fastify global auth hook + audit hook, expressed as a small wrapper each
 * handler opts into. Authentication, permission checks, the append-only audit
 * trail and error-to-HTTP mapping all live here so the handlers stay tiny.
 */

export interface Ctx {
  orgId: string;
  userId: string;
  userName: string;
  permissions: Set<Permission>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (err && typeof err === "object" && "statusCode" in err) {
    const s = (err as { statusCode?: unknown }).statusCode;
    if (typeof s === "number") return s;
  }
  return 500;
}

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

export async function authenticate(req: NextRequest): Promise<Ctx | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyToken<{ userId: string }>(token) : null;
  if (!payload?.userId) return null;
  return loadCtx(payload.userId);
}

type NextCtx = { params?: Record<string, string> | Promise<Record<string, string>> };
type AuthedHandler = (a: {
  ctx: Ctx;
  req: NextRequest;
  params: Record<string, string>;
}) => Promise<unknown> | unknown;
type PublicHandler = (a: {
  req: NextRequest;
  params: Record<string, string>;
}) => Promise<unknown> | unknown;

async function finish(
  ctx: Ctx | null,
  req: NextRequest,
  result: unknown,
): Promise<Response> {
  // Append-only audit of every mutation (never let it break the request).
  if (req.method !== "GET" && ctx) {
    try {
      const url = new URL(req.url);
      await db.insert(auditLog).values({
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: `${req.method} ${url.pathname}`,
        after: { ok: true },
      });
    } catch {
      /* ignore audit failures */
    }
  }
  if (result instanceof NextResponse) return result;
  return NextResponse.json(result ?? { ok: true });
}

/** Authenticated handler. `permission`, when set, is required to proceed. */
export function route(opts: { permission?: Permission }, handler: AuthedHandler) {
  return async (req: NextRequest, context: NextCtx): Promise<Response> => {
    try {
      const ctx = await authenticate(req);
      if (!ctx) return NextResponse.json({ error: "authentication required" }, { status: 401 });
      if (opts.permission && !ctx.permissions.has(opts.permission)) {
        return NextResponse.json(
          { error: `missing permission: ${opts.permission}` },
          { status: 403 },
        );
      }
      const params = context?.params ? await context.params : {};
      const result = await handler({ ctx, req, params });
      return finish(ctx, req, result);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: statusOf(err) });
    }
  };
}

/** Public handler — no authentication (login, health). */
export function publicRoute(handler: PublicHandler) {
  return async (req: NextRequest, context: NextCtx): Promise<Response> => {
    try {
      const params = context?.params ? await context.params : {};
      const result = await handler({ req, params });
      return finish(null, req, result);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: statusOf(err) });
    }
  };
}

/** 201 Created helper. */
export function created(data: unknown): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

/** Parse + validate a JSON body against a Zod schema, throwing 400 on failure. */
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(400, JSON.stringify(parsed.error.flatten()));
  }
  return parsed.data;
}

/** URL query params of a request. */
export function query(req: NextRequest): URLSearchParams {
  return new URL(req.url).searchParams;
}
