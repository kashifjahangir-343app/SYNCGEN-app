# SYNCGEN MQTT/backend foundation

This package is the first server-side milestone for SYNCGEN. It receives normalized MQTT telemetry from a Weintek MT8102iE, validates it, writes it to PostgreSQL/TimescaleDB, and broadcasts accepted values to browsers over WebSocket.

It is **read-only**. It contains no cloud control path for BESS, generators, or breakers.

## Included

- EMQX broker container
- PostgreSQL + TimescaleDB historian
- Node.js/TypeScript ingestion API
- Strict `syncgen.v1` payload validation
- Rejected-message log
- Gateway last-value/status table
- WebSocket endpoint at `/ws`
- Health endpoint at `/health`
- Gateway snapshot endpoint at `/api/v1/gateways`
- Five-second test publisher
- Unit tests for topics and payloads

## Repository placement

Upload this folder at the root of the `codex/mqtt--foundation` branch. It is deliberately separate from the existing frontend files. Do not upload it to `main`.

## Local commissioning sequence

1. Copy `.env.example` to `.env`.
2. Replace every `CHANGE_ME` value with a strong development-only password.
3. Run `docker compose up -d emqx timescaledb`.
4. Open the local EMQX dashboard at `http://localhost:18083`.
5. Create two built-in-database MQTT users:
   - `syncgen_ingestor` for the backend subscriber.
   - `SITE001_HMI001` for the test publisher/HMI.
6. Configure authorization so:
   - `SITE001_HMI001` can publish only `syncgen/v1/JME/SITE001/HMI001/telemetry`.
   - `syncgen_ingestor` can subscribe only `syncgen/v1/+/+/+/telemetry`.
7. Put the matching `syncgen_ingestor` password into `.env`.
8. Run `docker compose up -d --build api`.
9. Check `http://localhost:8080/health`.
10. Set `MQTT_SIMULATOR_PASSWORD` in your shell to the simulator account password and run `npm run simulate`.
11. Open `ws://localhost:8080/ws` using a WebSocket client and confirm a telemetry envelope arrives every five seconds.
12. Check `http://localhost:8080/api/v1/gateways` for `JME / SITE001 / HMI001`.

## Production gates

Do not expose the included local ports directly to the internet. Before connecting an installed HMI:

- use a VPS firewall;
- terminate HTTPS/WSS through a reverse proxy;
- enable MQTT over TLS on port 8883;
- issue unique credentials per HMI;
- configure topic ACLs;
- replace every development password;
- pin and review container versions;
- configure backups and retention;
- add authentication/RBAC to HTTP and WebSocket access;
- complete an HMI-to-broker FAT using a test project before changing a production HMI.

## Frontend handoff

The existing React app should eventually consume:

```text
ws://localhost:8080/ws
```

Each message has this envelope:

```json
{
  "type": "telemetry",
  "customerId": "JME",
  "siteId": "SITE001",
  "gatewayId": "HMI001",
  "receivedAt": "2026-09-14T04:30:05.000Z",
  "status": "GOOD",
  "payload": {
    "schema": "syncgen.v1",
    "timestamp": "2026-09-14T09:30:00+05:00",
    "sequence": 1,
    "quality": "good",
    "metrics": { "grid.power_kw": 48.6 }
  }
}
```

The simulator must remain clearly labeled and must never be presented as a live plant or live MQTT connection.

