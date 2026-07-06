// High-level example: reads the sensor on a schedule and logs template strings.
import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const serial = core.serial();
const sensor = new DHT(2, "DHT22");

core.init(() => {
  sensor.begin();
});

core.every("readSensor", 2000, () => {
  serial.log(`Temperature: ${sensor.temperature()}`);
  serial.log(`Humidity: ${sensor.humidity()}`);
});
