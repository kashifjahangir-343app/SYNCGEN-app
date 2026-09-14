# SYNCGEN MQTT Contract v1

## Scope

This contract is for read-only telemetry from a Weintek MT8102iE acting as the site gateway. Commands are intentionally outside the Week-1 pilot.

## Topic

```text
syncgen/v1/{customer_id}/{site_id}/{gateway_id}/telemetry
```

Pilot example:

```text
syncgen/v1/JME/SITE001/HMI001/telemetry
```

Each identity segment may contain letters, numbers, `_`, and `-`, up to 64 characters. Each HMI must have unique broker credentials and may publish only beneath its assigned topic prefix.

## Payload

```json
{
  "schema": "syncgen.v1",
  "timestamp": "2026-09-14T09:30:00+05:00",
  "sequence": 12876,
  "quality": "good",
  "metrics": {
    "grid.voltage_l1_v": 231.4,
    "grid.voltage_l2_v": 230.8,
    "grid.voltage_l3_v": 232.1,
    "grid.current_l1_a": 72.4,
    "grid.current_l2_a": 70.8,
    "grid.current_l3_a": 73.1,
    "grid.power_kw": 48.6,
    "grid.frequency_hz": 49.98,
    "grid.power_factor": 0.96,
    "grid.energy_import_kwh": 284621.7,
    "solar.power_kw": 37.2,
    "solar.energy_today_kwh": 218.4,
    "solar.energy_lifetime_kwh": 786421.3,
    "communications.meter_ok": 1,
    "communications.inverter_ok": 1
  }
}
```

## Rules

- Publish one packet approximately every five seconds.
- Use an ISO-8601 timestamp with an explicit offset or `Z`.
- Increment `sequence` for every packet, including when values do not change.
- Metric values must be JSON numbers, not formatted strings.
- Use `quality`: `good`, `bad`, or `comm_fail`.
- Use `1`/`0` for HMI boolean registers in v1.
- Do not retain telemetry packets.
- Use QoS 1 for the pilot.
- Protection and fast control remain local. No breaker, BESS, or generator commands are accepted by this package.

## Status interpretation

| Cloud status | Meaning |
|---|---|
| `GOOD` | Valid packet with `quality=good` |
| `BAD` | Valid packet reports bad source quality |
| `COMM_FAIL` | HMI reports field-device communication failure |
| `STALE` | No valid packet within the configured threshold |
| `OFFLINE` | Reserved for broker Last Will/status-topic integration in the next milestone |

