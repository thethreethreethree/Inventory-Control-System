import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { env } from "./env";
import { setupAuth } from "./lib/auth";
import { attachmentRoutes, UPLOAD_DIR } from "./routes/attachments";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { itemRoutes } from "./routes/items";
import { locationRoutes } from "./routes/locations";
import { balanceRoutes } from "./routes/balances";
import { movementRoutes } from "./routes/movements";
import { transferRoutes } from "./routes/transfers";
import { userRoutes } from "./routes/users";
import { supplierRoutes } from "./routes/suppliers";
import { purchaseOrderRoutes } from "./routes/purchaseOrders";
import { goodsReceiptRoutes } from "./routes/goodsReceipts";
import { invoiceRoutes } from "./routes/invoices";
import { countRoutes } from "./routes/counts";
import { adjustmentRoutes } from "./routes/adjustments";
import { periodRoutes } from "./routes/periods";
import { recipeRoutes } from "./routes/recipes";
import { salesImportRoutes } from "./routes/salesImports";
import { reportRoutes } from "./routes/reports";
import { categoryRoutes } from "./routes/categories";
import { settingsRoutes } from "./routes/settings";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
setupAuth(app);
await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: "/uploads/" });
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: "/auth" });
await app.register(userRoutes, { prefix: "/users" });
await app.register(itemRoutes, { prefix: "/items" });
await app.register(locationRoutes, { prefix: "/locations" });
await app.register(balanceRoutes, { prefix: "/balances" });
await app.register(movementRoutes, { prefix: "/movements" });
await app.register(transferRoutes, { prefix: "/transfers" });
await app.register(supplierRoutes, { prefix: "/suppliers" });
await app.register(purchaseOrderRoutes, { prefix: "/purchase-orders" });
await app.register(goodsReceiptRoutes, { prefix: "/goods-receipts" });
await app.register(invoiceRoutes, { prefix: "/invoices" });
await app.register(countRoutes, { prefix: "/counts" });
await app.register(adjustmentRoutes, { prefix: "/adjustments" });
await app.register(periodRoutes, { prefix: "/periods" });
await app.register(recipeRoutes, { prefix: "/recipes" });
await app.register(salesImportRoutes, { prefix: "/sales-imports" });
await app.register(reportRoutes, { prefix: "/reports" });
await app.register(categoryRoutes, { prefix: "/categories" });
await app.register(settingsRoutes, { prefix: "/settings" });
await app.register(attachmentRoutes, { prefix: "/attachments" });

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
