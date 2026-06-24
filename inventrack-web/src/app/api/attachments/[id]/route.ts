import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { attachments } from "@/server/db/schema";
import { publicRoute, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

// Serve a stored receipt image. Public by capability URL — the uuid is the
// unguessable token (same model as the original served /uploads/<hash> files),
// so a plain <a href> link works without an auth header.
export const GET = publicRoute(async ({ params }) => {
  const [att] = await db
    .select({ data: attachments.data })
    .from(attachments)
    .where(eq(attachments.id, params.id))
    .limit(1);
  const match = att?.data ? /^data:([^;]+);base64,(.*)$/s.exec(att.data) : null;
  if (!match) throw new HttpError(404, "not found");
  const bytes = Buffer.from(match[2], "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "private, max-age=3600",
    },
  });
});
