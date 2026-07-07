// Low-level example: initializes SD and polls file existence in loop.
import { Ino } from "@inojs/core";
import { SDCard } from "@inojs/sd";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const card = new SDCard(10);

core.setup(() => {
  card.begin(10);
});

core.loop(() => {
  if (card.exists("/old.txt")) {
    card.remove("/old.txt");
    core.log("old.txt removed");
  }

  core.delay(2000);
});
