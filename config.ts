import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.string().default("info"),
  MQTT_URL: z.string().url(),
  MQTT_USERNAME: z.string().min(1),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_TOPIC: z.string().default("syncgen/v1/+/+/+/telemetry"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromString,
  CORS_ORIGIN: z.string().min(1),
  STALE_AFTER_SECONDS: z.coerce.number().int().min(5).default(20)
});

export const config = configSchema.parse(process.env);

