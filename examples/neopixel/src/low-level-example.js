// Low-level example: writes colors with blocking delays.
import { Ino } from "@inojs/core";
import { NeoPixel } from "@inojs/neopixel";

const core = new Ino();
const strip = new NeoPixel(8, 6);

core.setup(() => {
  strip.begin();
  strip.brightness(32);
});

core.loop(() => {
  strip.setPixelColor(0, 64, 0, 0);
  strip.show();
  core.delay(500);
  strip.clear();
  strip.show();
  core.delay(500);
});
