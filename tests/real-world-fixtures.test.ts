import { describe, expect, it } from "vitest";
import { dhtPlugin } from "../plugins/dht/src/index.js";
import { lcdPlugin } from "../plugins/lcd/src/index.js";
import { mqttPlugin } from "../plugins/mqtt/src/index.js";
import { oledPlugin } from "../plugins/oled/src/index.js";
import { sdPlugin } from "../plugins/sd/src/index.js";
import { servoPlugin } from "../plugins/servo/src/index.js";
import { wifiPlugin } from "../plugins/wifi/src/index.js";
import { generate } from "./helpers.js";

describe("real-world compiler fixtures", () => {
  it("compiles array LED scanning", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";

      const core = new Ino();
      const pins = [3, 5, 6];

      core.app(() => {
        for (let i = 0; i < pins.length; i++) {
          core.log(pins[i]);
        }
      });
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain("int pins[] = {3, 5, 6};");
  });

  it("compiles DHT plus OLED dashboard", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { DHT } from "@inojs/dht";
      import { OLED } from "@inojs/oled";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const sensor = new DHT(2, "DHT22");
      const screen = new OLED(128, 64);

      core.init(() => {
        sensor.begin();
        screen.begin();
        screen.textSize(1);
        screen.textColor(1);
      });

      core.every("refresh", 2000, () => {
        const temperature = sensor.temperature();
        const humidity = sensor.humidity();
        screen.clear();
        screen.setCursor(0, 0);
        screen.print(\`Temp \${temperature}\`);
        screen.setCursor(0, 16);
        screen.print(\`Humidity \${humidity}\`);
        screen.display();
      });
    `, [dhtPlugin, oledPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([]);
  });

  it("compiles WiFi plus MQTT telemetry", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { WiFiConnection } from "@inojs/wifi";
      import { MQTT } from "@inojs/mqtt";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const wifi = new WiFiConnection();
      const mqtt = new MQTT();

      core.init(() => {
        wifi.begin("SSID", "PASSWORD");
        mqtt.setServer("broker.local", 1883);
        mqtt.connect("inojs-node");
      });

      core.every("telemetry", 5000, () => {
        mqtt.loop();
        mqtt.publish("inojs/heartbeat", "alive");
      });
    `, [wifiPlugin, mqttPlugin], { board: "esp32dev" });

    expect(result.diagnostics).toEqual([]);
  });

  it("compiles SD logger checks", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { SDCard } from "@inojs/sd";

      const core = new Ino({ serialMonitor: true, baudRate: 115200 });
      const card = new SDCard(10);

      core.init(() => {
        card.begin();
      });

      core.every("checkLog", 1000, () => {
        if (card.exists("/log.txt")) {
          core.log("present");
        } else {
          core.log("missing");
        }
      });
    `, [sdPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([]);
  });

  it("compiles button plus servo control", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { Servo } from "@inojs/servo";

      const core = new Ino();
      const button = core.button(2, { pullup: true });
      const servo = new Servo(9);
      let open = false;

      core.init(() => {
        button.init();
        servo.attach();
      });

      button.onPress(() => {
        if (open) {
          servo.write(0);
          open = false;
        } else {
          servo.write(90);
          open = true;
        }
      });
    `, [servoPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([]);
  });

  it("compiles LCD switch status display", () => {
    const result = generate(`
      import { Ino } from "@inojs/core";
      import { LCD } from "@inojs/lcd";

      const core = new Ino();
      const lcd = new LCD(0x27, 16, 2);
      let state = 0;

      core.init(() => {
        lcd.start();
      });

      core.every("status", 1000, () => {
        switch (state) {
          case 0:
            lcd.line(0, "Idle");
            break;
          default:
            lcd.line(0, "Active");
            break;
        }
        state++;
        if (state > 1) {
          state = 0;
        }
      });
    `, [lcdPlugin], { board: "uno" });

    expect(result.diagnostics).toEqual([]);
  });
});
