// Low-level example: reads, writes, commits, and delays in the main loop.
import { Ino } from "@inojs/core";
import { EEPROMStore } from "@inojs/eeprom";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const memory = new EEPROMStore();

core.setup(() => {
  memory.begin(64);
});

core.loop(() => {
  const value = memory.read(0);
  memory.write(0, value + 1);
  memory.commit();
  core.log("EEPROM", value);
  core.delay(5000);
});
