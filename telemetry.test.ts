import { describe, expect, it } from "vitest";
import { telemetryPayloadSchema } from "../src/domain/telemetry.js";

describe("telemetry payload", () => {
  it("accepts a valid MT8102iE packet", () => {
    const result = telemetryPayloadSchema.safeParse({
      schema: "syncgen.v1",
      timestamp: "2026-09-14T09:30:00+05:00",
      sequence: 1,
      quality: "good",
      metrics: { "grid.power_kw": 48.6, "solar.energy_today_kwh": 218.4 }
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric telemetry values", () => {
    const result = telemetryPayloadSchema.safeParse({
      schema: "syncgen.v1",
      timestamp: "2026-09-14T09:30:00+05:00",
      sequence: 1,
      quality: "good",
      metrics: { "grid.power_kw": "48.6" }
    });
    expect(result.success).toBe(false);
  });
});

