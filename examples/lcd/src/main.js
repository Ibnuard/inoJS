import { Ino } from "@inojs/core";
import { LCD } from "@inojs/lcd";

const core = new Ino();
const lcd = new LCD(0x27, 16, 2);

core.setup(() => {
  lcd.begin();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hello inoJS");
});

core.loop(() => {
  lcd.setCursor(0, 1);
  lcd.print(core.millis());
  core.delay(1000);
});
