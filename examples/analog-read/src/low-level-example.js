// Low-level example: uses Arduino-like setup/loop, pin APIs, and explicit serial output.
import { Ino } from "@inojs/core";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const sensor = core.pin(34);
const led = core.pin(5);
const serial = core.serial();

core.setup(() => {
  led.output();
});

core.loop(() => {
  const value = sensor.analogRead();
  led.pwm(value);
  serial.println(value);
  core.delay(50);
});
