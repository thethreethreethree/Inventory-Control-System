import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type AppSettings } from "@ics/shared";
import { db } from "../db/client";
import { orgs } from "../db/schema";
import { httpError } from "../lib/errors";

export async function getSettings(orgId: string): Promise<AppSettings> {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) throw httpError("org not found", 404);
  const stored = (org.settings ?? {}) as Partial<AppSettings>;
  // businessName is the org name (single source of truth); other keys live in settings.
  return { ...DEFAULT_SETTINGS, ...stored, businessName: org.name };
}

export async function updateSettings(
  orgId: string,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const next = { ...(await getSettings(orgId)), ...patch };
  const { businessName, ...rest } = next;
  await db.update(orgs).set({ name: businessName, settings: rest }).where(eq(orgs.id, orgId));
  return next;
}
