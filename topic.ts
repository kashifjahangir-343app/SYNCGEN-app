import type { TopicIdentity } from "../domain/telemetry.js";

const segmentPattern = /^[A-Za-z0-9_-]{1,64}$/;

export function parseTelemetryTopic(topic: string): TopicIdentity {
  const parts = topic.split("/");
  if (parts.length !== 6 || parts[0] !== "syncgen" || parts[1] !== "v1" || parts[5] !== "telemetry") {
    throw new Error("Topic must be syncgen/v1/{customer}/{site}/{gateway}/telemetry");
  }

  const customerId = parts[2];
  const siteId = parts[3];
  const gatewayId = parts[4];
  if (!customerId || !siteId || !gatewayId || ![customerId, siteId, gatewayId].every((part) => segmentPattern.test(part))) {
    throw new Error("Topic identity contains an invalid segment");
  }

  return { customerId, siteId, gatewayId };
}
