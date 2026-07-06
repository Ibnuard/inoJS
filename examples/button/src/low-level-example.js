// Low-level example: polls the button in loop and mirrors its state to the LED.
import { Ino } from "@inojs/core";

const core = new Ino();
const button = core.button(2, { pullup: true });
const led = core.pin(13);

core.setup(() => {
  button.init();
  led.output();
});

core.loop(() => {
  if (button.isPressed()) {
    led.high();
  } else {
    led.low();
  }
});
