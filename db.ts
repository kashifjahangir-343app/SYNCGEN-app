import pg from "pg";
import { config } from "./config.js";
import type { LiveEnvelope, TopicIdentity } from "./domain/telemetry.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: true } : false,
  max: 10
});

export async function assertDatabaseReady(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function storeTelemetry(envelope: LiveEnvelope): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const metricEntries = Object.entries(envelope.payload.metrics);
    for (const [metric, value] of metricEntries) {
      await client.query(
        `INSERT INTO telemetry
          (time, customer_id, site_id, gateway_id, sequence, quality, metric, value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          envelope.payload.timestamp,
          envelope.customerId,
          envelope.siteId,
          envelope.gatewayId,
          envelope.payload.sequence,
          envelope.payload.quality,
          metric,
          value
        ]
      );
    }

    await client.query(
      `INSERT INTO gateway_state
        (customer_id, site_id, gateway_id, status, last_seen_at, last_message, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (customer_id, site_id, gateway_id)
       DO UPDATE SET status = EXCLUDED.status,
                     last_seen_at = EXCLUDED.last_seen_at,
                     last_message = EXCLUDED.last_message,
                     updated_at = NOW()`,
      [
        envelope.customerId,
        envelope.siteId,
        envelope.gatewayId,
        envelope.status,
        envelope.receivedAt,
        envelope.payload
      ]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function storeRejectedMessage(topic: string, payload: string, reason: string): Promise<void> {
  await pool.query(
    "INSERT INTO rejected_messages (topic, payload, reason) VALUES ($1, $2, $3)",
    [topic, payload.slice(0, 20_000), reason.slice(0, 1_000)]
  );
}

export async function markGatewayStale(identity: TopicIdentity): Promise<void> {
  await pool.query(
    `UPDATE gateway_state SET status = 'STALE', updated_at = NOW()
     WHERE customer_id = $1 AND site_id = $2 AND gateway_id = $3
       AND status <> 'STALE'`,
    [identity.customerId, identity.siteId, identity.gatewayId]
  );
}

export async function readLatestGatewayStates(): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT customer_id, site_id, gateway_id, status, last_seen_at, last_message, updated_at
     FROM gateway_state ORDER BY customer_id, site_id, gateway_id`
  );
  return result.rows;
}

