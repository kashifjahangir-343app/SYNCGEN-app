import { describe, expect, it } from "vitest";
import { parseTelemetryTopic } from "../src/mqtt/topic.js";

describe("parseTelemetryTopic", () => {
  it("extracts the HMI identity", () => {
    expect(parseTelemetryTopic("syncgen/v1/JME/SITE001/HMI001/telemetry")).toEqual({
      customerId: "JME",
      siteId: "SITE001",
      gatewayId: "HMI001"
    });
  });

  it("rejects an unexpected topic", () => {
    expect(() => parseTelemetryTopic("syncgen/v1/JME/SITE001/HMI001/command")).toThrow();
  });
});

