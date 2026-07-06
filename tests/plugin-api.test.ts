import { describe, expect, it } from "vitest";
import type { InoPlugin } from "../packages/plugin-api/src/index.js";
import { generate } from "./helpers.js";

describe("plugin API", () => {
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
});
