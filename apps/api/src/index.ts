import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { itemRoutes } from "./routes/items";
import { balanceRoutes } from "./routes/balances";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: "/auth" });
await app.register(itemRoutes, { prefix: "/items" });
await app.register(balanceRoutes, { prefix: "/balances" });

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
