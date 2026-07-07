import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../packages/compiler/src/index.js";

async function createProject(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "inojs-local-imports-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "ino.config.json"), `${JSON.stringify({ board: "esp32dev" }, null, 2)}\n`, "utf8");

  for (const [path, contents] of Object.entries(files)) {
    const fullPath = join(root, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, "utf8");
  }

  return root;
}

describe("local imports", () => {
  it("compiles helper functions from local files before the entry", async () => {
    const root = await createProject({
      "src/math.js": `
        export function scale(value: number): number {
          return value * 2;
        }
      `,
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { scale } from "./math.js";

        const core = new Ino({ serialMonitor: true, baudRate: 115200 });

        core.app(() => {
          core.log(scale(21));
        });
      `
    });

    const result = await compileProject({ cwd: root });
    const generated = await readFile(result.generatedCppPath, "utf8");

    expect(result.diagnostics).toEqual([]);
    expect(generated).toContain("double scale(double value) {");
    expect(generated.indexOf("double scale")).toBeLessThan(generated.indexOf("void setup()"));
    expect(generated).toContain("Serial.println(scale(21));");
  });

  it("uses JSDoc types from JavaScript helper files", async () => {
    const root = await createProject({
      "src/math.js": `
        /**
         * @param {number} value
         * @returns {number}
         */
        export function triple(value) {
          return value * 3;
        }
      `,
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { triple } from "./math.js";

        const core = new Ino({ serialMonitor: true, baudRate: 115200 });

        core.app(() => {
          core.log(triple(7));
        });
      `
    });

    const result = await compileProject({ cwd: root });
    const generated = await readFile(result.generatedCppPath, "utf8");

    expect(result.diagnostics).toEqual([]);
    expect(generated).toContain("double triple(double value) {");
  });

  it("resolves folder index imports and nested local dependencies", async () => {
    const root = await createProject({
      "src/display/index.js": `
        import { prefix } from "../labels.js";

        export function statusLabel(): string {
          return prefix() + " ready";
        }
      `,
      "src/labels.js": `
        export function prefix(): string {
          return "inoJS";
        }
      `,
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { statusLabel } from "./display";

        const core = new Ino({ serialMonitor: true, baudRate: 115200 });

        core.app(() => {
          core.log(statusLabel());
        });
      `
    });

    const result = await compileProject({ cwd: root });
    const generated = await readFile(result.generatedCppPath, "utf8");

    expect(result.diagnostics).toEqual([]);
    expect(generated).toContain("String prefix() {");
    expect(generated).toContain("String statusLabel() {");
    expect(generated).toContain('return prefix() + " ready";');
  });

  it("resolves TypeScript local modules", async () => {
    const root = await createProject({
      "src/sensors.ts": `
        export function threshold(): number {
          return 512;
        }
      `,
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { threshold } from "./sensors";

        const core = new Ino({ serialMonitor: true, baudRate: 115200 });

        core.app(() => {
          core.log(threshold());
        });
      `
    });

    const result = await compileProject({ cwd: root });
    const generated = await readFile(result.generatedCppPath, "utf8");

    expect(result.diagnostics).toEqual([]);
    expect(generated).toContain("double threshold() {");
  });

  it("reports unresolved local imports", async () => {
    const root = await createProject({
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { missing } from "./missing.js";

        const core = new Ino();
        core.app(() => {});
      `
    });

    await expect(compileProject({ cwd: root })).rejects.toThrow("Unable to resolve local import");
  });

  it("reports circular local imports", async () => {
    const root = await createProject({
      "src/a.js": `
        import { b } from "./b.js";
        export function a(): number {
          return b();
        }
      `,
      "src/b.js": `
        import { a } from "./a.js";
        export function b(): number {
          return a();
        }
      `,
      "src/main.js": `
        import { Ino } from "@inojs/core";
        import { a } from "./a.js";

        const core = new Ino();
        core.app(() => {
          a();
        });
      `
    });

    await expect(compileProject({ cwd: root })).rejects.toThrow("Circular local import detected");
  });
});
