import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { stockCounts, countLines } from "@/server/db/schema";
import { route, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ params }) => {
  const [count] = await db
    .select()
    .from(stockCounts)
    .where(eq(stockCounts.id, params.id))
    .limit(1);
  if (!count) throw new HttpError(404, "not found");
  const lines = await db.select().from(countLines).where(eq(countLines.countId, params.id));
  return { ...count, lines };
});
