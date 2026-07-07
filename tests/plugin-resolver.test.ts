import { describe, expect, it } from "vitest";
import { resolveProjectPlugins } from "../packages/compiler/src/index.js";
import { parseSource } from "./helpers.js";

describe("plugin resolver", () => {
  it("resolves plugins from imported packages", () => {
    const parsed = parseSource(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(9);
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual(["@inojs/servo"]);
  });

  it("resolves the DHT plugin from imports", () => {
    const parsed = parseSource(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";

      const core = new Ino();
      const sensor = new DHT(2, "DHT22");
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual(["@inojs/dht"]);
  });

  it("resolves the LCD plugin from imports", () => {
    const parsed = parseSource(`
      import { Ino } from "@inojs/core";
      import { LCD } from "@inojs/lcd";

      const core = new Ino();
      const lcd = new LCD();
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual(["@inojs/lcd"]);
  });

  it("resolves all official modules", () => {
    const parsed = parseSource(`
      import { Bluetooth } from "@inojs/bluetooth";
      import { DHT } from "@inojs/dht";
      import { EEPROMStore } from "@inojs/eeprom";
      import { LCD } from "@inojs/lcd";
      import { MQTT } from "@inojs/mqtt";
      import { NeoPixel } from "@inojs/neopixel";
      import { OLED } from "@inojs/oled";
      import { SDCard } from "@inojs/sd";
      import { Servo } from "@inojs/servo";
      import { WiFiConnection } from "@inojs/wifi";
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual([
      "@inojs/dht",
      "@inojs/eeprom",
      "@inojs/lcd",
      "@inojs/mqtt",
      "@inojs/neopixel",
      "@inojs/oled",
      "@inojs/sd",
      "@inojs/servo",
      "@inojs/wifi",
      "@inojs/bluetooth"
    ]);
  });

  it("does not resolve plugins that are not imported", () => {
    const parsed = parseSource(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
    `);

    expect(resolveProjectPlugins(parsed.ast)).toEqual([]);
  });
});
