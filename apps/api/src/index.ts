import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { setupAuth } from "./lib/auth";
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

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
setupAuth(app);
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

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
