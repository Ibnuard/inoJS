import { describe, expect, it } from "vitest";
import { dhtPlugin } from "../plugins/dht/src/index.js";
import { generate } from "./helpers.js";

describe("DHT plugin", () => {
  it("generates DHT sensor firmware with return values and dependencies", () => {
    const result = generate(`
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
        serial.println(temperature);
        serial.println(humidity);
        core.delay(2000);
      });
    `, [dhtPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.libDeps).toEqual(["adafruit/DHT sensor library"]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>
      #include <DHT.h>

      DHT dht_sensor(2, DHT22);

      void setup() {
        Serial.begin(115200);
        dht_sensor.begin();
      }

      void loop() {
        auto temperature = dht_sensor.readTemperature();
        auto humidity = dht_sensor.readHumidity();
        Serial.println(temperature);
        Serial.println(humidity);
        delay(2000);
      }
      "
    `);
  });

  it("reports DHT construction without a pin", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";

      const core = new Ino();
      const sensor = new DHT();

      core.setup(() => {
        sensor.begin();
      });

      core.loop(() => {});
    `, [dhtPlugin]);

    expect(result.diagnostics).toEqual([
      {
        level: "error",
        message: "DHT constructor requires a pin.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 22
        }
      }
    ]);
    expect(result.code).toContain("DHT dht_sensor(0, DHT22);");
  });

  it("generates high-level DHT temperature and humidity aliases", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const serial = core.serial();
      const sensor = new DHT(2, "DHT22");

      core.init(() => {
        sensor.begin();
      });

      core.every("readSensor", 2000, () => {
        serial.log(\`Temperature: \${sensor.temperature()}\`);
        serial.log(\`Humidity: \${sensor.humidity()}\`);
      });
    `, [dhtPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("dht_sensor.readTemperature()");
    expect(result.code).toContain("dht_sensor.readHumidity()");
    expect(result.code).toContain('Serial.println("Temperature: " + String(dht_sensor.readTemperature()));');
    expect(result.code).toContain('Serial.println("Humidity: " + String(dht_sensor.readHumidity()));');
  });

  it("reports unsupported DHT methods once", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";

      const core = new Ino();
      const sensor = new DHT(2);

      core.setup(() => {});

      core.loop(() => {
        sensor.readHeatIndex();
      });
    `, [dhtPlugin]);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Unsupported DHT method: readHeatIndex",
        location: {
          filename: "src/main.js",
          line: 11,
          column: 16
        }
      }
    ]);
    expect(result.code).toContain("/* unsupported DHT method: readHeatIndex */;");
  });
});
