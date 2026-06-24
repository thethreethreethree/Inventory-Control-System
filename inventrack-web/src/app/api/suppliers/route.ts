import { asc, eq } from "drizzle-orm";
import { createSupplierSchema } from "@ics/shared";
import { db } from "@/server/db/client";
import { suppliers } from "@/server/db/schema";
import { route, parseBody, created } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => {
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.orgId, ctx.orgId))
    .orderBy(asc(suppliers.name));
});

export const POST = route({ permission: "po.create" }, async ({ ctx, req }) => {
  const data = await parseBody(req, createSupplierSchema);
  const [supplier] = await db
    .insert(suppliers)
    .values({
      orgId: ctx.orgId,
      name: data.name,
      terms: data.terms ?? null,
      leadTimeDays: data.leadTimeDays ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
    })
    .returning();
  return created(supplier);
});
