import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema } from "@ics/shared";
import { db } from "../db/client";
import { users } from "../db/schema";
import { verifyPassword } from "../lib/password";

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

    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    // Stub token. Real session/JWT with permission claims + audit logging of the
    // login event comes in the auth phase (SYSTEM_DESIGN sect. 3, module 11).
    return {
      token: `dev.${user.id}`,
      user: { id: user.id, name: user.name, email: user.email },
    };
  });
}
