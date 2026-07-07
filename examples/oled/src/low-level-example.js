// Low-level example: explicitly clears, writes, displays, then waits.
import { Ino } from "@inojs/core";
import { OLED } from "@inojs/oled";

const core = new Ino();
const screen = new OLED(128, 64);

core.setup(() => {
  screen.begin();
  screen.textSize(1);
  screen.textColor(1);
});

core.loop(() => {
  screen.clear();
  screen.setCursor(0, 0);
  screen.print("Millis");
  screen.setCursor(0, 16);
  screen.print(core.millis());
  screen.display();
  core.delay(1000);
});
