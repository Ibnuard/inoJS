// Low-level example: uses explicit setup/loop, serial print calls, and blocking delay.
import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const serial = core.serial();
const sensor = new DHT(2, "DHT22");

core.setup(() => {
  sensor.begin();
});

core.loop(() => {
  const temperature = sensor.readTemperature();
  const humidity = sensor.readHumidity();

  serial.print("Temperature: ");
  serial.println(temperature);
  serial.print("Humidity: ");
  serial.println(humidity);
  core.delay(2000);
});
