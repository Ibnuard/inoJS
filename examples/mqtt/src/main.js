// High-level example: keeps MQTT serviced and publishes a heartbeat.
import { Ino } from "@inojs/core";
import { WiFiConnection } from "@inojs/wifi";
import { MQTT } from "@inojs/mqtt";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const wifi = new WiFiConnection();
const mqtt = new MQTT();

core.init(() => {
  wifi.begin("SSID", "PASSWORD");
  mqtt.setServer("broker.hivemq.com", 1883);
  mqtt.connect("inojs-client");
});

core.every("heartbeat", 5000, () => {
  mqtt.loop();
  mqtt.publish("inojs/heartbeat", "alive");
  core.log("MQTT heartbeat");
});
