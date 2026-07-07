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
        do {
          core.delay(1000);
        } while (true);
      });
    `);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Unsupported statement in setup/loop: DoWhileStatement",
        location: {
          filename: "src/main.js",
          line: 7,
          column: 9
        }
      }
    ]);
  });

  it("generates typed helper functions and for loops", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const sensor = core.pin(34);

      function readAverage(samples: number): number {
        let total = 0;
        for (let i = 0; i < samples; i++) {
          total = total + sensor.analogRead();
        }
        return total / samples;
      }

      core.init(() => {});

      core.app(() => {
        const value = readAverage(4);
        core.log("avg", value);
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      double readAverage(double samples) {
        int total = 0;
        for (int i = 0; i < samples; i++) {
          total = total + analogRead(34);
        }
        return total / samples;
      }

      void setup() {
        Serial.begin(115200);
      }

      void loop() {
        auto value = readAverage(4);
        Serial.print("avg");
        Serial.print(" ");
        Serial.println(value);
      }
      "
    `);
  });

  it("generates array literals, index access, and length checks", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const pins = [2, 3, 4];

      core.app(() => {
        for (let i = 0; i < pins.length; i++) {
          core.log(pins[i]);
        }
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("int pins[] = {2, 3, 4};");
    expect(result.code).toContain("for (int i = 0; i < (sizeof(pins) / sizeof(pins[0])); i++) {");
    expect(result.code).toContain("Serial.println(pins[i]);");
  });

  it("generates while, break, continue, and switch control flow", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      let mode = 0;

      core.app(() => {
        while (mode < 3) {
          mode++;
          if (mode == 1) {
            continue;
          }
          switch (mode) {
            case 2:
              core.delay(10);
              break;
            default:
              break;
          }
        }
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("while (mode < 3) {");
    expect(result.code).toContain("continue;");
    expect(result.code).toContain("switch (mode) {");
    expect(result.code).toContain("case 2:");
    expect(result.code).toContain("default:");
    expect(result.code).toContain("break;");
  });

  it("infers simple declaration and return types", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const enabled = true;
      const label = "ok";
      const ratio = 0.5;

      function answer() {
        return 42;
      }

      core.app(() => {
        const now = core.millis();
        const value = answer();
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("bool enabled = true;");
    expect(result.code).toContain('String label = "ok";');
    expect(result.code).toContain("double ratio = 0.5;");
    expect(result.code).toContain("int answer() {");
    expect(result.code).toContain("unsigned long now = millis();");
    expect(result.code).toContain("auto value = answer();");
  });

  it("reports board-aware analog and PWM pin validation errors", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const sensor = core.pin(13);
      const led = core.pin(8);

      core.app(() => {
        const value = sensor.analogRead();
        led.pwm(value);
      });
    `, [], { board: "uno" });

    expect(result.diagnostics).toEqual([
      {
        level: "error",
        message: "Pin 13 does not support analog on board uno.",
        location: {
          filename: "src/main.js",
          line: 5,
          column: 31
        }
      },
      {
        level: "error",
        message: "Pin 8 does not support PWM on board uno.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 28
        }
      }
    ]);
  });

  it("generates void helper functions", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const led = core.led(13);

      function blinkOnce(): void {
        led.on();
        core.delay(10);
        led.off();
      }

      core.init(() => {
        led.output();
      });

      core.app(() => {
        blinkOnce();
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("void blinkOnce() {");
    expect(result.code).toContain("digitalWrite(13, HIGH);");
    expect(result.code).toContain("delay(10);");
    expect(result.code).toContain("blinkOnce();");
  });

  it("warns when helper function signatures are not stable enough for C++", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();

      function scale(value) {
        return value * 2;
      }

      core.app(() => {
        scale(2);
      });
    `);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Function parameter value should declare a type for stable C++ generation.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 22
        }
      },
      {
        level: "warning",
        message: "Function scale should declare a return type for stable C++ generation.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 7
        }
      }
    ]);
    expect(result.code).toContain("auto scale(double value) {");
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
        unsigned long value = millis();
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

  it("generates button input helpers", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const button = core.button(2, { pullup: true });
      const led = core.led(13);

      core.init(() => {
        button.init();
        led.output();
      });

      core.app(() => {
        if (button.isPressed()) {
          led.on();
        } else {
          led.off();
        }
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      void setup() {
        pinMode(2, INPUT_PULLUP);
        pinMode(13, OUTPUT);
      }

      void loop() {
        if (digitalRead(2) == LOW) {
          digitalWrite(13, HIGH);
        }
        else {
          digitalWrite(13, LOW);
        }
      }
      "
    `);
  });

  it("generates button onPress edge detection", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const button = core.button(2, { pullup: true });
      const led = core.led(13);

      core.init(() => {
        button.init();
        led.output();
      });

      button.onPress(() => {
        led.toggle();
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>

      bool inojs_button_button_pressed = false;

      void setup() {
        pinMode(2, INPUT_PULLUP);
        pinMode(13, OUTPUT);
      }

      void loop() {
        bool inojs_button_button_current = digitalRead(2) == LOW;
        if (inojs_button_button_current && !inojs_button_button_pressed) {
          digitalWrite(13, !digitalRead(13));
        }
        inojs_button_button_pressed = inojs_button_button_current;
      }
      "
    `);
  });

  it("reports board-aware pin validation errors for core pins and buttons", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const led = core.led(99);
      const button = core.button(20, { pullup: true });

      core.init(() => {
        led.output();
        button.init();
      });

      core.app(() => {});
    `, [], { board: "uno" });

    expect(result.diagnostics).toEqual([
      {
        level: "error",
        message: "Pin 99 is not valid for board uno.",
        location: {
          filename: "src/main.js",
          line: 5,
          column: 28
        }
      },
      {
        level: "error",
        message: "Pin 20 is not valid for board uno.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 34
        }
      }
    ]);
  });
});
