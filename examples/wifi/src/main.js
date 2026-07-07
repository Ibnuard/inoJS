// High-level example: connects once and logs status periodically.
import { Ino } from "@inojs/core";
import { WiFiConnection } from "@inojs/wifi";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const wifi = new WiFiConnection();

core.init(() => {
  wifi.begin("SSID", "PASSWORD");
});

core.every("wifiStatus", 2000, () => {
  core.log("WiFi", wifi.status(), wifi.localIP());
});
