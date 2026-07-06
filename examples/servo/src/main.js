import { Ino } from "@inojs/core";
import { Servo } from "@inojs/servo";

const core = new Ino();
const arm = new Servo(9);

core.setup(() => {
  arm.attach();
});

core.loop(() => {
  arm.write(0);
  core.delay(500);
  arm.write(90);
  core.delay(500);
  arm.write(180);
  core.delay(500);
});
