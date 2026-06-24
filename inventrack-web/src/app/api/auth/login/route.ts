import { eq } from "drizzle-orm";
import { loginSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/server/lib/password";
import { signToken } from "@/server/lib/token";
import { publicRoute, parseBody, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = publicRoute(async ({ req }) => {
  const data = await parseBody(req, loginSchema);
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!user || user.status !== "active" || !verifyPassword(data.password, user.passwordHash)) {
    throw new HttpError(401, "Invalid credentials");
  }
  return {
    token: signToken({ userId: user.id }),
    user: { id: user.id, name: user.name, email: user.email },
  };
});
