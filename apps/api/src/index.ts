import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { itemRoutes } from "./routes/items";
import { locationRoutes } from "./routes/locations";
import { balanceRoutes } from "./routes/balances";
import { movementRoutes } from "./routes/movements";
import { transferRoutes } from "./routes/transfers";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: "/auth" });
await app.register(itemRoutes, { prefix: "/items" });
await app.register(locationRoutes, { prefix: "/locations" });
await app.register(balanceRoutes, { prefix: "/balances" });
await app.register(movementRoutes, { prefix: "/movements" });
await app.register(transferRoutes, { prefix: "/transfers" });

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
