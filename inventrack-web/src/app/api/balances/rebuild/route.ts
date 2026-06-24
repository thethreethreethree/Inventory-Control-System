import { db } from "@/server/db/client";
import { rebuildBalances } from "@/server/services/ledger";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Rebuild the cache from the ledger (self-heal + proof of derivability). */
export const POST = route({ permission: "movement.read" }, async ({ ctx }) => {
  await rebuildBalances(ctx.orgId);
  return { rebuilt: true };
});
