/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { compileProject } from "../packages/compiler/src/index.js";

const examplesRoot = join(process.cwd(), "examples");
const entries = ["src/main.js", "src/low-level-example.js"];

describe("examples", () => {
  it("compile without diagnostics", async () => {
    const examples = await readdir(examplesRoot, { withFileTypes: true });
    const projects = examples.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

    for (const project of projects) {
      for (const entry of entries) {
        const result = await compileProject({
          cwd: join(examplesRoot, project),
          entry,
          outDir: `.ino/test-${entry.replace(/[^a-zA-Z0-9]/g, "-")}`
        });

        expect(result.diagnostics, `${project}/${entry}`).toEqual([]);
      }
    }
  });
});
