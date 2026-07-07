// High-level example: refreshes a small OLED status screen on a schedule.
import { Ino } from "@inojs/core";
import { OLED } from "@inojs/oled";

const core = new Ino();
const screen = new OLED(128, 64);

core.init(() => {
  screen.begin();
  screen.textSize(1);
  screen.textColor(1);
});

core.every("refreshDisplay", 1000, () => {
  screen.clear();
  screen.setCursor(0, 0);
  screen.print("inoJS OLED");
  screen.setCursor(0, 16);
  screen.print(core.millis());
  screen.display();
});
