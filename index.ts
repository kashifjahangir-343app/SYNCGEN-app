import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { assertDatabaseReady, pool, readLatestGatewayStates } from "./db.js";
import { MqttIngestor } from "./mqtt/ingestor.js";
import { RealtimeHub } from "./realtime/hub.js";

const app = Fastify({ logger: { level: config.LOG_LEVEL } });
const hub = new RealtimeHub();
const ingestor = new MqttIngestor(hub);

await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
await app.register(websocket);

app.get("/health", async () => ({ status: "ok", websocketClients: hub.size }));

app.get("/api/v1/gateways", async () => ({ gateways: await readLatestGatewayStates() }));

app.get("/ws", { websocket: true }, (socket) => {
  hub.add(socket);
  socket.send(JSON.stringify({ type: "connected", at: new Date().toISOString() }));
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  await ingestor.stop();
  await app.close();
  await pool.end();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await assertDatabaseReady();
ingestor.start();
await app.listen({ port: config.PORT, host: "0.0.0.0" });

