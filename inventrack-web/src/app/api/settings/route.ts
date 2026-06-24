import { updateSettingsSchema } from "@ics/shared";
import { getSettings, updateSettings } from "@/server/services/settings";
import { route, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => getSettings(ctx.orgId));

export const PUT = route({ permission: "user.manage" }, async ({ ctx, req }) => {
  const data = await parseBody(req, updateSettingsSchema);
  return updateSettings(ctx.orgId, data);
});
