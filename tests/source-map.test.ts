import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../packages/compiler/src/index.js";
import { remapGeneratedLine, type LineMapping } from "../packages/source-map/src/index.js";

describe("source map generation", () => {
  it("maps generated C++ lines back to source statements", async () => {
    const root = await mkdtemp(join(tmpdir(), "inojs-source-map-"));
    await mkdir(join(root, "src"), { recursive: true });
    const sourcePath = join(root, "src/main.js");
    await writeFile(sourcePath, [
      'import { Ino } from "@inojs/core";',
      "",
      "const core = new Ino({ serialMonitor: true, baudRate: 115200 });",
      "const pins = [2, 3, 4];",
      "",
      "function echo(value: number): void {",
      "  core.log(value);",
      "}",
      "",
      "core.app(() => {",
      "  for (let i = 0; i < pins.length; i++) {",
      "    echo(pins[i]);",
      "  }",
      "});",
      ""
    ].join("\n"), "utf8");

    const result = await compileProject({ cwd: root });
    const generated = await readFile(result.generatedCppPath, "utf8");
    const mappings = JSON.parse(await readFile(result.sourceMapPath, "utf8")) as LineMapping[];
    const generatedLines = generated.split("\n");
    const echoCallLine = generatedLines.findIndex((line) => line.trim() === "echo(pins[i]);") + 1;
    const serialPrintLine = generatedLines.findIndex((line) => line.trim() === "Serial.println(value);") + 1;

    expect(echoCallLine).toBeGreaterThan(0);
    expect(serialPrintLine).toBeGreaterThan(0);
    expect(mappings).toContainEqual({
      generatedLine: echoCallLine,
      source: {
        filename: sourcePath,
        line: 12,
        column: 5
      }
    });
    expect(mappings).toContainEqual({
      generatedLine: serialPrintLine,
      source: {
        filename: sourcePath,
        line: 7,
        column: 3
      }
    });
    expect(remapGeneratedLine(mappings, echoCallLine).source).toEqual({
      filename: sourcePath,
      line: 12,
      column: 5
    });
  });
});
