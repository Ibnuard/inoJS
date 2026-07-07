// High-level example: checks for a file on a schedule.
import { Ino } from "@inojs/core";
import { SDCard } from "@inojs/sd";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const card = new SDCard(10);

core.init(() => {
  card.begin();
});

core.every("checkCard", 2000, () => {
  if (card.exists("/log.txt")) {
    core.log("log.txt found");
  } else {
    core.log("log.txt missing");
  }
});
