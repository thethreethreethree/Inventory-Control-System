import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Minimal stateless signed token (HMAC-SHA256 over a base64url JSON payload).
 * Dependency-free stand-in for JWT — same shape (`payload.sig`), good enough for
 * this app's session needs. Swap for a vetted JWT lib if richer claims are needed.
 */

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function signToken(payload: Record<string, unknown>, ttlMs = 1000 * 60 * 60 * 12): string {
  const full = { ...payload, exp: nowMs() + ttlMs };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (typeof payload.exp !== "number" || nowMs() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// new Date()/Date.now() are available at runtime here (this is a normal Node
// process, not a workflow script).
function nowMs(): number {
  return Date.now();
}
