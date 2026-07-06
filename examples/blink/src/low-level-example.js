// Low-level example: uses Arduino-like setup/loop and blocking delay.
import { Ino } from "@inojs/core";

const core = new Ino();
const led = core.pin(13);

core.setup(() => {
  led.output();
});

core.loop(() => {
  led.toggle();
  core.delay(1000);
});
