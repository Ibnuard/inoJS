// High-level example: sweeps the servo with state and a non-blocking schedule.
import { Ino } from "@inojs/core";
import { Servo } from "@inojs/servo";

const core = new Ino();
const arm = new Servo(9);
let angle = 0;
let step = 90;

core.init(() => {
  arm.attach();
});

core.every("sweep", 500, () => {
  arm.write(angle);
  angle = angle + step;

  if (angle >= 180 || angle <= 0) {
    step = -step;
  }
});
