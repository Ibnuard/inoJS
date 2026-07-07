import { describe, expect, it } from "vitest";
import {
  boardProfiles,
  boardSupportsCapability,
  getDefaultPlatform,
  isValidDigitalPin
} from "../packages/config/src/index.js";
import { generatePlatformIOIni } from "../packages/platformio/src/index.js";

describe("board configuration", () => {
  it("exposes PlatformIO defaults from board profiles", () => {
    expect(getDefaultPlatform("uno")).toBe("atmelavr");
    expect(getDefaultPlatform("esp32dev")).toBe("espressif32");
    expect(getDefaultPlatform("unknown-board")).toBeUndefined();
  });

  it("validates board capabilities from shared config", () => {
    expect(boardSupportsCapability("esp32dev", "wifi")).toBe(true);
    expect(boardSupportsCapability("esp32dev", "bluetooth")).toBe(true);
    expect(boardSupportsCapability("uno", "wifi")).toBe(false);
    expect(boardSupportsCapability("unknown-board", "wifi")).toBeUndefined();
  });

  it("validates digital pins from shared config", () => {
    expect(isValidDigitalPin("uno", 13)).toBe(true);
    expect(isValidDigitalPin("uno", 20)).toBe(false);
    expect(isValidDigitalPin("esp32dev", 34)).toBe(true);
    expect(isValidDigitalPin("esp32dev", 20)).toBe(false);
    expect(isValidDigitalPin("unknown-board", 99)).toBeUndefined();
  });

  it("keeps board ids available for docs and UI surfaces", () => {
    expect(Object.keys(boardProfiles).sort()).toEqual([
      "bluepill_f103c8",
      "due",
      "esp32dev",
      "genericSTM32F103C8",
      "megaatmega2560",
      "nanoatmega328",
      "nodemcuv2",
      "pico",
      "rpipico",
      "teensy41",
      "uno"
    ]);
  });

  it("uses shared board config when generating platformio.ini", () => {
    expect(generatePlatformIOIni({ board: "esp32dev" })).toContain("platform = espressif32");
    expect(generatePlatformIOIni({ board: "unknown-board" })).toContain("platform = atmelavr");
  });
});
