// Low-level equivalent kept single-file for comparison.
import { Ino } from "@inojs/core";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const sensor = core.pin(34);
const alertLed = core.led(5);

core.init(() => {
  alertLed.output();
});

core.every("sample", 1000, () => {
  const raw = sensor.analogRead();

  if (raw > 700) {
    alertLed.on();
  } else {
    alertLed.off();
  }

  core.log("sensor", raw);
});
