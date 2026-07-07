// Low-level example: explicit WiFi, MQTT connect, loop, publish, delay.
import { Ino } from "@inojs/core";
import { WiFiConnection } from "@inojs/wifi";
import { MQTT } from "@inojs/mqtt";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const wifi = new WiFiConnection();
const mqtt = new MQTT();

core.setup(() => {
  wifi.begin("SSID", "PASSWORD");
  mqtt.setServer("broker.hivemq.com", 1883);
  mqtt.connect("inojs-client");
});

core.loop(() => {
  mqtt.loop();
  mqtt.publish("inojs/status", "online");
  core.delay(5000);
});
