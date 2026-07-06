import { describe, expect, it } from "vitest";
import { servoPlugin } from "../plugins/servo/src/index.js";
import { generate } from "./helpers.js";

describe("Servo plugin", () => {
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

  it("reports board-aware Servo pin validation errors", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const arm = new Servo(99);

      core.init(() => {
        arm.attach();
      });

      core.app(() => {});
    `, [servoPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([
      {
        level: "error",
        message: "Pin 99 is not valid for board uno.",
        location: {
          filename: "src/main.js",
          line: 6,
          column: 29
        }
      }
    ]);
  });
});
