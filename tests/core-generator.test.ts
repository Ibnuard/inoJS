import { describe, expect, it } from "vitest";
import { generate } from "./helpers.js";

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

  it("generates init/app lifecycle aliases", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const led = core.pin(13);

      core.init(() => {
        led.output();
      });

      core.app(() => {
        led.toggle();
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
      }
      "
    `);
  });

  it("generates non-blocking every tasks", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const led = core.led(13);

      core.init(() => {
        led.output();
      });

      core.app(() => {
        core.every("blink", 1000, () => {
          led.toggle();
        });
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      unsigned long inojs_every_blink = 0;

      void setup() {
        pinMode(13, OUTPUT);
      }

      void loop() {
        if (millis() - inojs_every_blink >= 1000) {
          inojs_every_blink = millis();
          digitalWrite(13, !digitalRead(13));
        }
      }
      "
    `);
  });

  it("generates top-level every tasks", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const led = core.led(13);

      core.init(() => {
        led.output();
      });

      core.every(500, () => {
        led.on();
        led.off();
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("unsigned long inojs_every_task = 0;");
    expect(result.code).toContain("if (millis() - inojs_every_task >= 500) {");
    expect(result.code).toContain("digitalWrite(13, HIGH);");
    expect(result.code).toContain("digitalWrite(13, LOW);");
  });

  it("generates core.log with automatic Serial.begin", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();

      core.app(() => {
        core.log("Millis", core.millis());
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        Serial.begin(115200);
      }

      void loop() {
        Serial.print("Millis");
        Serial.print(" ");
        Serial.println(millis());
      }
      "
    `);
  });

  it("generates serial.log as print calls with a newline at the end", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const serial = core.serial();

      core.app(() => {
        const value = core.millis();
        serial.log("Temp ", value);
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        Serial.begin(115200);
      }

      void loop() {
        auto value = millis();
        Serial.print("Temp ");
        Serial.println(value);
      }
      "
    `);
  });

  it("generates template literals for serial logging", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const serial = core.serial();

      core.app(() => {
        const value = core.millis();
        serial.log(\`Temp \${value}\`);
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain('Serial.println("Temp " + String(value));');
  });
});
