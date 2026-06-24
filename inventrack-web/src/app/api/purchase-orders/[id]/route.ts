import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { purchaseOrders, poLines } from "@/server/db/schema";
import { route, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ params }) => {
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, params.id))
    .limit(1);
  if (!po) throw new HttpError(404, "not found");
  const lines = await db.select().from(poLines).where(eq(poLines.poId, params.id));
  return { ...po, lines };
});
