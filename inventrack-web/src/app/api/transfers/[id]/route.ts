import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { transfers, transferLines } from "@/server/db/schema";
import { route, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ params }) => {
  const [transfer] = await db.select().from(transfers).where(eq(transfers.id, params.id)).limit(1);
  if (!transfer) throw new HttpError(404, "not found");
  const lines = await db
    .select()
    .from(transferLines)
    .where(eq(transferLines.transferId, params.id));
  return { ...transfer, lines };
});
