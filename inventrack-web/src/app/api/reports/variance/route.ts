import { variance } from "@/server/services/reports";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => variance(ctx.orgId));
