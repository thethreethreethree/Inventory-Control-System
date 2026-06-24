import { desc, eq } from "drizzle-orm";
import { createTransferSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { transfers } from "@/server/db/schema";
import { createTransfer } from "@/server/services/transfers";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

// Create a transfer (source debited now; destination credited on confirm).
export const POST = route({ permission: "transfer.create" }, async ({ ctx, req }) => {
  const input = await parseBody(req, createTransferSchema);
  const transfer = await createTransfer({
    orgId: ctx.orgId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    reasonCode: input.reasonCode ?? null,
    issuedByUserId: input.issuedByUserId ?? ctx.userId,
    lines: input.lines,
  });
  return created(transfer);
});

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(transfers)
    .where(eq(transfers.orgId, ctx.orgId))
    .orderBy(desc(transfers.issuedAt));
});
