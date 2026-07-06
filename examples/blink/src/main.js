import { Ino } from "@inojs/core";

const core = new Ino();
const led = core.led(13);

core.init(() => {
  led.output();
});

core.every("blink", 1000, () => {
  led.toggle();
});
