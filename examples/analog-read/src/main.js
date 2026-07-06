// High-level example: uses inoJS init/every and core.log for non-blocking sampling.
import { Ino } from "@inojs/core";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const sensor = core.pin(34);
const led = core.led(5);

core.init(() => {
  led.output();
});

core.every("sample", 50, () => {
  const value = sensor.analogRead();
  led.pwm(value);
  core.log(value);
});
