// High-level example: toggles the LED once each time the button is pressed.
import { Ino } from "@inojs/core";

const core = new Ino();
const button = core.button(2, { pullup: true });
const led = core.led(13);

core.init(() => {
  button.init();
  led.output();
});

button.onPress(() => {
  led.toggle();
});
