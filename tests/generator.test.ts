import { describe, expect, it } from "vitest";
import type { InoPlugin } from "../packages/plugin-api/src/index.js";
import { resolveProjectPlugins } from "../packages/compiler/src/index.js";
import { generateArduinoCpp } from "../packages/generator/src/index.js";
import { parse } from "../packages/parser/src/index.js";
import { dhtPlugin } from "../plugins/dht/src/index.js";
import { servoPlugin } from "../plugins/servo/src/index.js";

function generate(source: string, plugins = []) {
  const parsed = parse(source, { filename: "src/main.js" });
  return generateArduinoCpp(parsed.ast, { plugins });
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

  it("generates Servo plugin code and PlatformIO dependencies", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(9);

      core.setup(() => {
        arm.attach();
      });

      core.loop(() => {
        arm.write(90);
      });
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.libDeps).toEqual(["arduino-libraries/Servo"]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>
      #include <Servo.h>

      Servo servo_arm;

      void setup() {
        servo_arm.attach(9);
      }

      void loop() {
        servo_arm.write(90);
      }
      "
    `);
  });

  it("resolves plugins from imported packages", () => {
    const parsed = parse(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(9);
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual(["@inojs/servo"]);
  });

  it("does not resolve plugins that are not imported", () => {
    const parsed = parse(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
    `);

    expect(resolveProjectPlugins(parsed.ast)).toEqual([]);
  });

  it("generates Servo attach with an explicit pin when the constructor has no pin", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo();

      core.setup(() => {
        arm.attach(9);
      });

      core.loop(() => {});
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("servo_arm.attach(9);");
  });

  it("reports Servo attach without any configured pin", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo();

      core.setup(() => {
        arm.attach();
      });

      core.loop(() => {});
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([
      {
        level: "error",
        message: "Servo.attach() requires a pin when the Servo constructor has no pin.",
        location: {
          filename: "src/main.js",
          line: 9,
          column: 9
        }
      }
    ]);
    expect(result.code).toContain("/* servo attach missing pin */;");
  });

  it("generates Servo detach calls", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(9);

      core.setup(() => {
        arm.attach();
      });

      core.loop(() => {
        arm.detach();
      });
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("servo_arm.detach();");
  });

  it("reports unsupported Servo methods once", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(9);

      core.setup(() => {});

      core.loop(() => {
        arm.sweep();
      });
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Unsupported Servo method: sweep",
        location: {
          filename: "src/main.js",
          line: 11,
          column: 13
        }
      }
    ]);
    expect(result.code).toContain("/* unsupported Servo method: sweep */;");
  });

  it("generates unique C++ globals for colliding Servo variable names", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm$ = new Servo(9);
      const arm_ = new Servo(10);

      core.setup(() => {
        arm$.attach();
        arm_.attach();
      });

      core.loop(() => {});
    `, [servoPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("Servo servo_arm_;");
    expect(result.code).toContain("Servo servo_arm__2;");
    expect(result.code).toContain("servo_arm_.attach(9);");
    expect(result.code).toContain("servo_arm__2.attach(10);");
  });

  it("lets plugins generate return-value expressions", () => {
    const sensorPlugin: InoPlugin = {
      name: "@inojs/sensor",
      packageName: "@inojs/sensor",
      symbols: ["Sensor"],
      analyzeDeclaration(declaration, context) {
        if (declaration.id.type !== "Identifier" || declaration.init?.type !== "NewExpression") return false;
        if (declaration.init.callee.type !== "Identifier" || declaration.init.callee.name !== "Sensor") return false;
        context.bindSymbol(declaration.id.name, {
          plugin: "@inojs/sensor",
          cppName: context.uniqueSymbol(declaration.id.name, "sensor")
        });
        return true;
      },
      generateCall(call, context) {
        if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
        if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "read") return undefined;
        const binding = context.getBinding(call.callee.object.name);
        return binding?.plugin === "@inojs/sensor" ? `${binding.cppName}.read()` : undefined;
      }
    };

    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Sensor } from "@inojs/sensor";

      const core = new Ino();
      const sensor = new Sensor();
      const serial = core.serial();

      core.setup(() => {});

      core.loop(() => {
        const value = sensor.read();
        serial.println(value);
      });
    `, [sensorPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("auto value = sensor_sensor.read();");
    expect(result.code).toContain("Serial.println(value);");
  });

  it("resolves the DHT plugin from imports", () => {
    const parsed = parse(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";

      const core = new Ino();
      const sensor = new DHT(2, "DHT22");
    `);

    expect(resolveProjectPlugins(parsed.ast).map((plugin) => plugin.name)).toEqual(["@inojs/dht"]);
  });

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
