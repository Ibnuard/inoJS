import { describe, expect, it } from "vitest";
import { assertNoCompilerErrors, formatDiagnostic, remapPlatformIOOutput } from "../apps/cli/src/index.js";
import type { LineMapping } from "../packages/source-map/src/index.js";

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

  it("adds source hints for generated PlatformIO errors", () => {
    const sourceMap: LineMapping[] = [
      {
        generatedLine: 15,
        source: {
          filename: "src/main.js",
          line: 7,
          column: 3
        }
      }
    ];

    expect(remapPlatformIOOutput("src/main.cpp:15:3: error: expected ';'\n", sourceMap)).toBe([
      "src/main.cpp:15:3: error: expected ';'",
      "inoJS source: src/main.js:7:3",
      ""
    ].join("\n"));
  });

  it("does not duplicate source hints for repeated generated locations on one line", () => {
    const sourceMap: LineMapping[] = [
      {
        generatedLine: 20,
        source: {
          filename: "src/main.js",
          line: 12,
          column: 5
        }
      }
    ];

    expect(remapPlatformIOOutput("error at src/main.cpp:20:1 and src/main.cpp:20:9\n", sourceMap)).toBe([
      "error at src/main.cpp:20:1 and src/main.cpp:20:9",
      "inoJS source: src/main.js:12:5",
      ""
    ].join("\n"));
  });

  it("leaves output unchanged when no mapping matches", () => {
    expect(remapPlatformIOOutput("src/main.cpp:99:1: error\n", [])).toBe("src/main.cpp:99:1: error\n");
  });
});
