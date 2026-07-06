import { describe, expect, it } from "vitest";
import { generateArduinoCpp } from "../packages/generator/src/index.js";
import { parse } from "../packages/parser/src/index.js";

function generate(source: string) {
  const parsed = parse(source, { filename: "src/main.js" });
  return generateArduinoCpp(parsed.ast);
}

describe("Arduino C++ generator", () => {
  it("generates blink firmware from the class-based API", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const board = new Ino();
      const led = board.pin(13);

      board.setup(() => {
        led.output();
      });

      board.loop(() => {
        led.toggle();
        board.delay(1000);
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        pinMode(13, OUTPUT);
      }

      void loop() {
        digitalWrite(13, !digitalRead(13));
        delay(1000);
      }
      "
    `);
  });

  it("generates serial and analog I/O", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const sensor = core.pin(34);
      const led = core.pin(5);
      const serial = core.serial();

      core.setup(() => {
        serial.begin(115200);
        led.output();
      });

      core.loop(() => {
        const value = sensor.analogRead();
        led.pwm(value);
        serial.println(value);
        core.delay(10);
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        Serial.begin(115200);
        pinMode(5, OUTPUT);
      }

      void loop() {
        auto value = analogRead(34);
        analogWrite(5, value);
        Serial.println(value);
        delay(10);
      }
      "
    `);
  });

  it("adds Serial.begin from core options when setup does not call it explicitly", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino({ serialMonitor: true, baudRate: 9600 });
      const serial = core.serial();

      core.setup(() => {});

      core.loop(() => {
        serial.println(core.millis());
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        Serial.begin(9600);
      }

      void loop() {
        Serial.println(millis());
      }
      "
    `);
  });

  it("reports unsupported syntax with source location", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();

      core.loop(() => {
        while (true) {
          core.delay(1000);
        }
      });
    `);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Unsupported statement in setup/loop: WhileStatement",
        location: {
          filename: "src/main.js",
          line: 7,
          column: 9
        }
      }
    ]);
  });
});
