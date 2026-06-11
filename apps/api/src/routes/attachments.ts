import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "../db/client";
import { attachments } from "../db/schema";
import { getCtx } from "../lib/auth";
import { httpError } from "../lib/errors";

/** Uploaded files live under apps/api/uploads (cwd is apps/api at runtime). */
export const UPLOAD_DIR = join(process.cwd(), "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

export async function attachmentRoutes(app: FastifyInstance) {
  // Upload a receipt photo (multipart). Stored by content hash; row recorded.
  app.post("/", async (req, reply) => {
    const ctx = getCtx(req);
    const file = await req.file();
    if (!file) throw httpError("no file uploaded", 400);
    if (!String(file.mimetype).startsWith("image/")) {
      throw httpError("only image files are allowed", 400);
    }
    const buf = await file.toBuffer();
    const sha = createHash("sha256").update(buf).digest("hex");
    const ext = (extname(file.filename || "") || ".jpg").toLowerCase();
    const filename = `${sha}${ext}`;
    writeFileSync(join(UPLOAD_DIR, filename), buf);
    const url = `/uploads/${filename}`;

    const [att] = await db
      .insert(attachments)
      .values({
        orgId: ctx.orgId,
        entityType: "receipt",
        fileUrl: url,
        sha256: sha,
        uploadedBy: ctx.userId,
      })
      .returning();
    return reply.code(201).send({ id: att?.id ?? null, url });
  });
}
