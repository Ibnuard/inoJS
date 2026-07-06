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

  it("does not resolve plugins that are not imported", () => {
    const parsed = parseSource(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
    `);

    expect(resolveProjectPlugins(parsed.ast)).toEqual([]);
  });
});
