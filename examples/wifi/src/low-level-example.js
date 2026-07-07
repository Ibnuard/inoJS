// Low-level example: connects in setup and prints status in loop.
import { Ino } from "@inojs/core";
import { WiFiConnection } from "@inojs/wifi";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const serial = core.serial();
const wifi = new WiFiConnection();

core.setup(() => {
  wifi.begin("SSID", "PASSWORD");
});

core.loop(() => {
  serial.print("Status: ");
  serial.println(wifi.status());
  serial.print("IP: ");
  serial.println(wifi.localIP());
  core.delay(2000);
});
