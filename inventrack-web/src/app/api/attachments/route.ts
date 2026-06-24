import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { attachments } from "@/server/db/schema";
import { route, created, HttpError } from "@/server/http";

export const dynamic = "force-dynamic";

// Upload a receipt photo (multipart). On serverless there is no writable disk,
// so the image is stored in the DB as a base64 data URL and served back via
// GET /api/attachments/:id. The row's id doubles as the capability URL.
export const POST = route({}, async ({ ctx, req }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "no file uploaded");
  if (!file.type.startsWith("image/")) {
    throw new HttpError(400, "only image files are allowed");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(buf).digest("hex");
  const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;

  const [att] = await db
    .insert(attachments)
    .values({
      orgId: ctx.orgId,
      entityType: "receipt",
      fileUrl: "",
      data: dataUrl,
      sha256: sha,
      uploadedBy: ctx.userId,
    })
    .returning();

  const url = `/attachments/${att.id}`;
  await db.update(attachments).set({ fileUrl: url }).where(eq(attachments.id, att.id));
  return created({ id: att.id, url });
});
