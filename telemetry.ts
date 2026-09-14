import { z } from "zod";

const metricKey = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_.]*$/, "Metric names must use lowercase dot notation");

export const telemetryPayloadSchema = z.object({
  schema: z.literal("syncgen.v1"),
  timestamp: z.string().datetime({ offset: true }),
  sequence: z.number().int().nonnegative(),
  quality: z.enum(["good", "bad", "comm_fail"]).default("good"),
  metrics: z.record(metricKey, z.number().finite())
}).strict();

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

export type TopicIdentity = {
  customerId: string;
  siteId: string;
  gatewayId: string;
};

export type LiveEnvelope = TopicIdentity & {
  type: "telemetry";
  receivedAt: string;
  status: "GOOD" | "BAD" | "COMM_FAIL";
  payload: TelemetryPayload;
};

