import { route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route({}, async ({ ctx }) => ({
  user: { id: ctx.userId, name: ctx.userName },
  permissions: [...ctx.permissions],
}));
