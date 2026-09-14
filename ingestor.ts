import mqtt, { type MqttClient } from "mqtt";
import { config } from "../config.js";
import { markGatewayStale, storeRejectedMessage, storeTelemetry } from "../db.js";
import { telemetryPayloadSchema, type LiveEnvelope, type TopicIdentity } from "../domain/telemetry.js";
import type { RealtimeHub } from "../realtime/hub.js";
import { parseTelemetryTopic } from "./topic.js";

export class MqttIngestor {
  private client: MqttClient | undefined;
  private readonly lastSeen = new Map<string, { identity: TopicIdentity; at: number }>();
  private staleTimer: NodeJS.Timeout | undefined;

  constructor(private readonly hub: RealtimeHub) {}

  start(): void {
    this.client = mqtt.connect(config.MQTT_URL, {
      username: config.MQTT_USERNAME,
      password: config.MQTT_PASSWORD,
      clientId: `syncgen-api-${process.pid}`,
      clean: true,
      reconnectPeriod: 2_000,
      connectTimeout: 10_000
    });

    this.client.on("connect", () => {
      this.client?.subscribe(config.MQTT_TOPIC, { qos: 1 }, (error) => {
        if (error) console.error("MQTT subscription failed", error);
        else console.info(`MQTT subscribed to ${config.MQTT_TOPIC}`);
      });
    });

    this.client.on("message", (topic, buffer) => void this.handleMessage(topic, buffer));
    this.client.on("error", (error) => console.error("MQTT error", error));
    this.client.on("offline", () => console.warn("MQTT connection offline"));

    this.staleTimer = setInterval(() => void this.detectStaleGateways(), 5_000);
  }

  async stop(): Promise<void> {
    if (this.staleTimer) clearInterval(this.staleTimer);
    await this.client?.endAsync();
  }

  private async handleMessage(topic: string, buffer: Buffer): Promise<void> {
    const raw = buffer.toString("utf8");
    try {
      const identity = parseTelemetryTopic(topic);
      const json: unknown = JSON.parse(raw);
      const payload = telemetryPayloadSchema.parse(json);
      const receivedAt = new Date().toISOString();
      const status = payload.quality === "good" ? "GOOD" : payload.quality === "comm_fail" ? "COMM_FAIL" : "BAD";
      const envelope: LiveEnvelope = { type: "telemetry", ...identity, receivedAt, status, payload };

      await storeTelemetry(envelope);
      this.lastSeen.set(this.key(identity), { identity, at: Date.now() });
      this.hub.broadcast(envelope);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown validation error";
      console.warn(`Rejected MQTT message on ${topic}: ${reason}`);
      try {
        await storeRejectedMessage(topic, raw, reason);
      } catch (dbError) {
        console.error("Could not persist rejected MQTT message", dbError);
      }
    }
  }

  private async detectStaleGateways(): Promise<void> {
    const staleMs = config.STALE_AFTER_SECONDS * 1_000;
    for (const { identity, at } of this.lastSeen.values()) {
      if (Date.now() - at <= staleMs) continue;
      this.hub.broadcast({ type: "gateway_status", ...identity, status: "STALE", detectedAt: new Date().toISOString() });
      this.lastSeen.delete(this.key(identity));
      try {
        await markGatewayStale(identity);
      } catch (error) {
        console.error("Could not persist stale gateway state", error);
      }
    }
  }

  private key(identity: TopicIdentity): string {
    return `${identity.customerId}/${identity.siteId}/${identity.gatewayId}`;
  }
}
