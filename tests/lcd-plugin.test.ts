import { describe, expect, it } from "vitest";
import { lcdPlugin } from "../plugins/lcd/src/index.js";
import { generate } from "./helpers.js";

describe("LCD plugin", () => {
  it("generates LCD firmware with cursor and print calls", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { LCD } from "@inojs/lcd";

      const core = new Ino();
      const lcd = new LCD(0x27, 16, 2);

      core.setup(() => {
        lcd.begin();
        lcd.backlight();
        lcd.setCursor(0, 0);
        lcd.print("Hello inoJS");
      });

      core.loop(() => {
        lcd.setCursor(0, 1);
        lcd.print(core.millis());
        core.delay(1000);
      });
    `, [lcdPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.libDeps).toEqual(["marcoschwartz/LiquidCrystal_I2C"]);
    expect(result.code).toMatchInlineSnapshot(`
      "#include <Arduino.h>
      #include <LiquidCrystal_I2C.h>

      LiquidCrystal_I2C lcd_lcd(39, 16, 2);

      void setup() {
        lcd_lcd.init();
        lcd_lcd.backlight();
        lcd_lcd.setCursor(0, 0);
        lcd_lcd.print("Hello inoJS");
      }

      void loop() {
        lcd_lcd.setCursor(0, 1);
        lcd_lcd.print(millis());
        delay(1000);
      }
      "
    `);
  });

  it("uses default LCD constructor arguments", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { LCD } from "@inojs/lcd";

      const core = new Ino();
      const screen = new LCD();

      core.setup(() => {
        screen.begin();
      });

      core.loop(() => {});
    `, [lcdPlugin]);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("LiquidCrystal_I2C lcd_screen(0x27, 16, 2);");
    expect(result.code).toContain("lcd_screen.init();");
  });

  it("reports unsupported LCD methods once", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { LCD } from "@inojs/lcd";

      const core = new Ino();
      const lcd = new LCD();

      core.setup(() => {});

      core.loop(() => {
        lcd.scrollLeft();
      });
    `, [lcdPlugin]);

    expect(result.diagnostics).toEqual([
      {
        level: "warning",
        message: "Unsupported LCD method: scrollLeft",
        location: {
          filename: "src/main.js",
          line: 11,
          column: 13
        }
      }
    ]);
    expect(result.code).toContain("/* unsupported LCD method: scrollLeft */;");
  });
});
