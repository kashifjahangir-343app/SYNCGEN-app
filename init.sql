CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
  time          TIMESTAMPTZ      NOT NULL,
  customer_id   TEXT             NOT NULL,
  site_id       TEXT             NOT NULL,
  gateway_id    TEXT             NOT NULL,
  sequence      BIGINT,
  quality       TEXT             NOT NULL,
  metric        TEXT             NOT NULL,
  value         DOUBLE PRECISION NOT NULL,
  unit          TEXT,
  received_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (time, customer_id, site_id, gateway_id, metric)
);

SELECT create_hypertable('telemetry', by_range('time'), if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS telemetry_lookup_idx
  ON telemetry (customer_id, site_id, gateway_id, metric, time DESC);

CREATE TABLE IF NOT EXISTS gateway_state (
  customer_id  TEXT        NOT NULL,
  site_id      TEXT        NOT NULL,
  gateway_id   TEXT        NOT NULL,
  status       TEXT        NOT NULL,
  last_seen_at TIMESTAMPTZ,
  last_message JSONB,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, site_id, gateway_id)
);

CREATE TABLE IF NOT EXISTS rejected_messages (
  id          BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  topic       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  payload     TEXT
);

