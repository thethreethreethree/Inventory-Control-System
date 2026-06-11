import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { changePasswordSchema, loginSchema } from "@ics/shared";
import { db } from "../db/client";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/token";
import { getCtx } from "../lib/auth";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (!user || user.status !== "active" || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    return {
      token: signToken({ userId: user.id }),
      user: { id: user.id, name: user.name, email: user.email },
    };
  });

  // Current session: who am I and what may I do.
  app.get("/me", async (req) => {
    const ctx = getCtx(req);
    return {
      user: { id: ctx.userId, name: ctx.userName },
      permissions: [...ctx.permissions],
    };
  });

  // Change your own password.
  app.put("/password", async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const ctx = getCtx(req);
    const [user] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return reply.code(401).send({ error: "current password is incorrect" });
    }
    await db
      .update(users)
      .set({ passwordHash: hashPassword(parsed.data.newPassword) })
      .where(eq(users.id, ctx.userId));
    return { ok: true };
  });
}
