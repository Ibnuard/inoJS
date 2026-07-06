import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const serial = core.serial();
const sensor = new DHT(2, "DHT22");

core.init(() => {
  sensor.begin();
});

core.every("readSensor", 2000, () => {
  const temperature = sensor.readTemperature();
  const humidity = sensor.readHumidity();

  serial.print("Temperature: ");
  serial.println(temperature);
  serial.print("Humidity: ");
  serial.println(humidity);
});
