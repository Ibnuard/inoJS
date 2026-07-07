import { describe, expect, it } from "vitest";
import { bluetoothPlugin } from "../plugins/bluetooth/src/index.js";
import { eepromPlugin } from "../plugins/eeprom/src/index.js";
import { mqttPlugin } from "../plugins/mqtt/src/index.js";
import { neoPixelPlugin } from "../plugins/neopixel/src/index.js";
import { oledPlugin } from "../plugins/oled/src/index.js";
import { sdPlugin } from "../plugins/sd/src/index.js";
import { wifiPlugin } from "../plugins/wifi/src/index.js";
import { generate } from "./helpers.js";

describe("official module stabilization", () => {
  it("reports board capability errors for WiFi-only modules", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { WiFiConnection } from "@inojs/wifi";

      const core = new Ino();
      const wifi = new WiFiConnection();

      core.setup(() => {
        wifi.begin("ssid", "password");
      });

      core.loop(() => {});
    `, [wifiPlugin], { board: "uno" });

    expect(result.diagnostics).toMatchObject([
      {
        level: "error",
        message: "Board uno does not support wifi."
      }
    ]);
  });

  it("generates WiFi and MQTT code for ESP32 boards", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { WiFiConnection } from "@inojs/wifi";
      import { MQTT } from "@inojs/mqtt";

      const core = new Ino();
      const wifi = new WiFiConnection();
      const mqtt = new MQTT();

      core.setup(() => {
        wifi.begin("ssid", "password");
        mqtt.setServer("broker.local", 1883);
      });

      core.loop(() => {
        mqtt.loop();
      });
    `, [wifiPlugin, mqttPlugin], { board: "esp32dev" });

    expect(result.diagnostics).toEqual([]);
    expect(result.libDeps).toEqual(["knolleary/PubSubClient"]);
    expect(result.code).toContain("#include <WiFi.h>");
    expect(result.code).toContain("#include <PubSubClient.h>");
    expect(result.code).toContain('WiFi.begin("ssid", "password");');
    expect(result.code).toContain('mqtt_mqtt.setServer("broker.local", 1883);');
  });

  it("reports unsupported pass-through methods for network modules", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Bluetooth } from "@inojs/bluetooth";

      const core = new Ino();
      const bluetooth = new Bluetooth();

      core.setup(() => {});

      core.loop(() => {
        bluetooth.rename("new-name");
      });
    `, [bluetoothPlugin], { board: "esp32dev" });

    expect(result.diagnostics).toMatchObject([
      {
        level: "warning",
        message: "Unsupported Bluetooth method: rename"
      }
    ]);
    expect(result.code).toContain("/* unsupported Bluetooth method: rename */;");
  });

  it("reports Bluetooth board capability errors", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Bluetooth } from "@inojs/bluetooth";

      const core = new Ino();
      const bluetooth = new Bluetooth();

      core.setup(() => {
        bluetooth.begin("inoJS");
      });

      core.loop(() => {});
    `, [bluetoothPlugin], { board: "uno" });

    expect(result.diagnostics).toMatchObject([
      {
        level: "error",
        message: "Board uno does not support bluetooth."
      }
    ]);
  });

  it("uses OLED constructor address in begin()", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { OLED } from "@inojs/oled";

      const core = new Ino();
      const oled = new OLED(128, 32, 0x3D);

      core.setup(() => {
        oled.begin();
      });

      core.loop(() => {});
    `, [oledPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("Adafruit_SSD1306 oled_oled(128, 32, &Wire, -1);");
    expect(result.code).toContain("oled_oled.begin(SSD1306_SWITCHCAPVCC, 61);");
  });

  it("reports missing NeoPixel constructor arguments", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { NeoPixel } from "@inojs/neopixel";

      const core = new Ino();
      const pixels = new NeoPixel();

      core.setup(() => {});
      core.loop(() => {});
    `, [neoPixelPlugin]);

    expect(result.diagnostics).toMatchObject([
      {
        level: "error",
        message: "NeoPixel constructor requires a pixel count."
      },
      {
        level: "error",
        message: "NeoPixel constructor requires a pin."
      }
    ]);
  });

  it("reports unsupported storage methods", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { EEPROMStore } from "@inojs/eeprom";
      import { SDCard } from "@inojs/sd";

      const core = new Ino();
      const eeprom = new EEPROMStore();
      const sd = new SDCard(10);

      core.setup(() => {});

      core.loop(() => {
        eeprom.clear();
        sd.open("/log.txt");
      });
    `, [eepromPlugin, sdPlugin], { board: "uno" });

    expect(result.diagnostics).toMatchObject([
      {
        level: "warning",
        message: "Unsupported EEPROM method: clear"
      },
      {
        level: "warning",
        message: "Unsupported SD method: open"
      }
    ]);
  });
});
