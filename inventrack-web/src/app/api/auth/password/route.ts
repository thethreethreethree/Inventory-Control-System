import { eq } from "drizzle-orm";
import { changePasswordSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/lib/password";
import { route, parseBody, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const PUT = route({}, async ({ ctx, req }) => {
  const data = await parseBody(req, changePasswordSchema);
  const [user] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (!user || !verifyPassword(data.currentPassword, user.passwordHash)) {
    throw new HttpError(401, "current password is incorrect");
  }
  await db
    .update(users)
    .set({ passwordHash: hashPassword(data.newPassword) })
    .where(eq(users.id, ctx.userId));
  return { ok: true };
});
