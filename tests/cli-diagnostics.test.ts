import { describe, expect, it } from "vitest";
import { assertNoCompilerErrors, formatDiagnostic } from "../apps/cli/src/index.js";

describe("CLI diagnostics", () => {
  it("formats source diagnostics for terminal output", () => {
    expect(formatDiagnostic({
      level: "error",
      message: "Pin 99 is not valid for board uno.",
      location: {
        filename: "src/main.js",
        line: 6,
        column: 29
      }
    })).toBe("src/main.js:6:29 error: Pin 99 is not valid for board uno.");
  });

  it("allows warnings to continue to PlatformIO", () => {
    expect(() => assertNoCompilerErrors([
      {
        level: "warning",
        message: "Unsupported statement in setup/loop: WhileStatement"
      }
    ])).not.toThrow();
  });

  it("fails before PlatformIO when compiler errors are present", () => {
    expect(() => assertNoCompilerErrors([
      {
        level: "error",
        message: "Board uno does not support wifi."
      }
    ])).toThrow("Compilation failed with 1 error. Fix compiler diagnostics before running PlatformIO.");
  });

  it("uses a plural message for multiple compiler errors", () => {
    expect(() => assertNoCompilerErrors([
      {
        level: "error",
        message: "NeoPixel constructor requires a pixel count."
      },
      {
        level: "error",
        message: "NeoPixel constructor requires a pin."
      }
    ])).toThrow("Compilation failed with 2 errors. Fix compiler diagnostics before running PlatformIO.");
  });
});
