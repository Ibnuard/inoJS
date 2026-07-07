// High-level example: environment dashboard with display, status pixel, and saved sample count.
import { Ino } from "@inojs/core";
import { DHT } from "@inojs/dht";
import { EEPROMStore } from "@inojs/eeprom";
import { NeoPixel } from "@inojs/neopixel";
import { OLED } from "@inojs/oled";

const core = new Ino({ serialMonitor: true, baudRate: 115200 });
const sensor = new DHT(2, "DHT22");
const memory = new EEPROMStore();
const pixel = new NeoPixel(1, 6);
const screen = new OLED(128, 64);
let samples = 0;

core.init(() => {
  sensor.begin();
  memory.begin(64);
  samples = memory.read(0);
  pixel.begin();
  pixel.brightness(24);
  screen.begin();
  screen.textSize(1);
  screen.textColor(1);
});

core.every("sampleEnvironment", 2000, () => {
  const temperature = sensor.temperature();
  const humidity = sensor.humidity();
  samples = samples + 1;
  memory.write(0, samples);
  memory.commit();

  if (temperature >= 30) {
    pixel.setPixelColor(0, 64, 0, 0);
  } else {
    pixel.setPixelColor(0, 0, 32, 32);
  }

  pixel.show();
  screen.clear();
  screen.setCursor(0, 0);
  screen.print(`Temp ${temperature}`);
  screen.setCursor(0, 16);
  screen.print(`Humidity ${humidity}`);
  screen.setCursor(0, 32);
  screen.print(`Samples ${samples}`);
  screen.display();
  core.log("env", temperature, humidity, samples);
});
