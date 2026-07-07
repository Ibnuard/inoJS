// High-level example: split sketch logic across local modules.
import { Ino } from "@inojs/core";
import { isHot, readAverage } from "./sensors.js";
import { statusLabel } from "./display/index.js";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const sensor = core.pin(34);
const alertLed = core.led(5);

core.init(() => {
  alertLed.output();
});

core.every("sample", 1000, () => {
  const raw = sensor.analogRead();
  const average = readAverage(4, raw);

  if (isHot(average)) {
    alertLed.on();
  } else {
    alertLed.off();
  }

  core.log("sensor", average, statusLabel(average));
});
