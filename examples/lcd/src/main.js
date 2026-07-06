import { Ino } from "@inojs/core";
import { LCD } from "@inojs/lcd";

const core = new Ino();
const lcd = new LCD(0x27, 16, 2);

core.init(() => {
  lcd.begin();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hello inoJS");
});

core.every("clock", 1000, () => {
  lcd.setCursor(0, 1);
  lcd.print(core.millis());
});
