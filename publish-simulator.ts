import "dotenv/config";
import mqtt from "mqtt";

const url = process.env.MQTT_SIMULATOR_URL ?? "mqtt://localhost:1883";
const username = process.env.MQTT_SIMULATOR_USERNAME ?? "SITE001_HMI001";
const password = process.env.MQTT_SIMULATOR_PASSWORD;
if (!password) throw new Error("Set MQTT_SIMULATOR_PASSWORD before running the simulator");

const topic = "syncgen/v1/JME/SITE001/HMI001/telemetry";
const client = mqtt.connect(url, {
  username,
  password,
  clientId: `sim-${Date.now()}`,
  clean: true
});

let sequence = 0;
client.on("connect", () => {
  console.info(`Simulator connected; publishing to ${topic}`);
  setInterval(() => {
    sequence += 1;
    const angle = sequence / 10;
    const payload = {
      schema: "syncgen.v1",
      timestamp: new Date().toISOString(),
      sequence,
      quality: "good",
      metrics: {
        "grid.voltage_l1_v": 230 + Math.sin(angle) * 2,
        "grid.voltage_l2_v": 231 + Math.sin(angle + 1) * 2,
        "grid.voltage_l3_v": 229 + Math.sin(angle + 2) * 2,
        "grid.current_l1_a": 70 + Math.sin(angle) * 4,
        "grid.current_l2_a": 69 + Math.sin(angle + 1) * 4,
        "grid.current_l3_a": 72 + Math.sin(angle + 2) * 4,
        "grid.power_kw": 48 + Math.sin(angle) * 3,
        "grid.frequency_hz": 50 + Math.sin(angle / 2) * 0.03,
        "grid.power_factor": 0.96,
        "grid.energy_import_kwh": 284621.7 + sequence * 0.07,
        "solar.power_kw": Math.max(0, 37 + Math.sin(angle) * 2),
        "solar.energy_today_kwh": 218.4 + sequence * 0.05,
        "solar.energy_lifetime_kwh": 786421.3 + sequence * 0.05,
        "communications.meter_ok": 1,
        "communications.inverter_ok": 1
      }
    };
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
  }, 5_000);
});

client.on("error", (error) => console.error("Simulator MQTT error", error));

