import type { FastifyInstance } from "fastify";
import { updateSettingsSchema } from "@ics/shared";
import { getCtx } from "../lib/auth";
import { statusOf } from "../lib/errors";
import { getSettings, updateSettings } from "../services/settings";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => getSettings(getCtx(req).orgId));

  app.put("/", async (req, reply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await updateSettings(getCtx(req).orgId, parsed.data);
    } catch (err) {
      return reply.code(statusOf(err)).send({ error: (err as Error).message });
    }
  });
}
