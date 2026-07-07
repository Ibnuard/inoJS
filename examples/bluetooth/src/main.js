// High-level example: sends a Bluetooth heartbeat and echoes incoming data.
import { Ino } from "@inojs/core";
import { Bluetooth } from "@inojs/bluetooth";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const bluetooth = new Bluetooth("inoJS");

core.init(() => {
  bluetooth.begin("inoJS");
});

core.every("bluetoothHeartbeat", 1000, () => {
  bluetooth.println("alive");

  if (bluetooth.available()) {
    core.log("Bluetooth RX", bluetooth.read());
  }
});
