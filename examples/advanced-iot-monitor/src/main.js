// High-level example: connected sensor node with MQTT heartbeat and SD maintenance.
import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";
import { MQTT } from "@inojs/mqtt";
import { SDCard } from "@inojs/sd";
import { WiFiConnection } from "@inojs/wifi";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const wifi = new WiFiConnection();
const mqtt = new MQTT();
const sensor = new DHT(4, "DHT22");
const card = new SDCard(5);

core.init(() => {
  wifi.begin("SSID", "PASSWORD");
  mqtt.setServer("broker.hivemq.com", 1883);
  mqtt.connect("inojs-iot-monitor");
  sensor.begin();
  card.begin();
});

core.every("publishTelemetry", 5000, () => {
  const temperature = sensor.temperature();
  const humidity = sensor.humidity();
  mqtt.loop();
  mqtt.publish("inojs/temperature", `${temperature}`);
  mqtt.publish("inojs/humidity", `${humidity}`);

  if (card.exists("/reset.flag")) {
    card.remove("/reset.flag");
    core.log("reset flag consumed");
  }

  core.log("iot", wifi.status(), temperature, humidity);
});
