// Low-level example: polls Bluetooth, echoes data, and delays.
import { Ino } from "@inojs/core";
import { Bluetooth } from "@inojs/bluetooth";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const bluetooth = new Bluetooth("inoJS");

core.setup(() => {
  bluetooth.begin("inoJS");
});

core.loop(() => {
  if (bluetooth.available()) {
    const value = bluetooth.read();
    bluetooth.print("RX ");
    bluetooth.println(value);
  }

  core.delay(100);
});
