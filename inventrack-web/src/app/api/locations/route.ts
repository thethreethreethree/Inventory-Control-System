import { asc, eq } from "drizzle-orm";
import { createLocationSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { locations } from "@/server/db/schema";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select({
      id: locations.id,
      name: locations.name,
      type: locations.type,
      active: locations.active,
    })
    .from(locations)
    .where(eq(locations.orgId, ctx.orgId))
    .orderBy(asc(locations.name));
});

export const POST = route({ permission: "user.manage" }, async ({ ctx, req }) => {
  const input = await parseBody(req, createLocationSchema);
  const [location] = await db
    .insert(locations)
    .values({ orgId: ctx.orgId, name: input.name, type: (input.type ?? "other") as never })
    .returning();
  return created(location);
});
