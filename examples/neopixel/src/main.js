// High-level example: blinks one NeoPixel without blocking.
import { Ino } from "@inojs/core";
import { NeoPixel } from "@inojs/neopixel";

const core = new Ino();
const strip = new NeoPixel(8, 6);
let on = false;

core.init(() => {
  strip.begin();
  strip.brightness(32);
});

core.every("pixelBlink", 500, () => {
  if (on) {
    strip.clear();
    on = false;
  } else {
    strip.setPixelColor(0, 0, 64, 16);
    on = true;
  }

  strip.show();
});
