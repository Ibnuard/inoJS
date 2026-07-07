// High-level example: increments a persisted counter every five seconds.
import { Ino } from "@inojs/core";
import { EEPROMStore } from "@inojs/eeprom";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const memory = new EEPROMStore();
let counter = 0;

core.init(() => {
  memory.begin(64);
  counter = memory.read(0);
});

core.every("persistCounter", 5000, () => {
  counter = counter + 1;
  memory.write(0, counter);
  memory.commit();
  core.log("Counter", counter);
});
