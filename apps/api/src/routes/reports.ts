import type { FastifyInstance } from "fastify";
import { getCtx } from "../lib/auth";
import { activity, expiry, reorder, valuation, variance } from "../services/reports";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function reportRoutes(app: FastifyInstance) {
  app.get("/valuation", async (req) => valuation(getCtx(req).orgId));
  app.get("/reorder", async (req) => reorder(getCtx(req).orgId));
  app.get("/variance", async (req) => variance(getCtx(req).orgId));

  app.get("/expiry", async (req) => {
    const days = Number((req.query as { days?: string }).days ?? 30) || 30;
    return expiry(getCtx(req).orgId, days);
  });

  app.get("/activity", async (req) => {
    const q = req.query as { from?: string; to?: string };
    const to = q.to ?? new Date().toISOString();
    const from = q.from ?? new Date(Date.now() - 30 * DAY_MS).toISOString();
    return activity(getCtx(req).orgId, from, to);
  });
}
