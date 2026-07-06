// High-level example: updates the display on a non-blocking schedule.
import { Ino } from "@inojs/core";
import { LCD } from "@inojs/lcd";

const core = new Ino();
const lcd = new LCD(0x27, 16, 2);

core.init(() => {
  lcd.start();
  lcd.line(0, "Hello inoJS");
});

core.every("clock", 1000, () => {
  lcd.line(1, `Millis ${core.millis()}`);
});
