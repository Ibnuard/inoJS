import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateArduinoCpp, type Diagnostic } from "@inojs/generator";
import { parse } from "@inojs/parser";
import { generatePlatformIOIni, type PlatformIOConfig } from "@inojs/platformio";

export type { Diagnostic } from "@inojs/generator";

export interface CompileOptions {
  cwd: string;
  entry?: string;
  outDir?: string;
  platformio?: PlatformIOConfig;
}

export interface CompileResult {
  generatedCppPath: string;
  platformioIniPath: string;
  diagnostics: Diagnostic[];
}

export async function compileProject(options: CompileOptions): Promise<CompileResult> {
  const entry = options.entry ?? await findEntry(options.cwd);
  const outDir = options.outDir ?? ".ino/generated";
  const config = await readProjectConfig(options.cwd);
  const sourcePath = join(options.cwd, entry);
  const source = await readFile(sourcePath, "utf8");
  const parsed = parse(source, { filename: sourcePath });
  const generated = generateArduinoCpp(parsed.ast);

  const generatedCppPath = join(options.cwd, outDir, "src/main.cpp");
  const platformioIniPath = join(options.cwd, outDir, "platformio.ini");

  await mkdir(dirname(generatedCppPath), { recursive: true });
  await writeFile(generatedCppPath, generated.code, "utf8");
  await writeFile(platformioIniPath, generatePlatformIOIni({
    board: "uno",
    ...config,
    ...options.platformio
  }), "utf8");

  return {
    generatedCppPath,
    platformioIniPath,
    diagnostics: generated.diagnostics
  };
}

async function findEntry(cwd: string): Promise<string> {
  for (const entry of ["src/main.ts", "src/main.js"]) {
    try {
      await access(join(cwd, entry));
      return entry;
    } catch {
      // Try the next conventional entry.
    }
  }

  return "src/main.js";
}

async function readProjectConfig(cwd: string): Promise<Partial<PlatformIOConfig>> {
  try {
    const raw = await readFile(join(cwd, "ino.config.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<PlatformIOConfig> & { serial?: { baudRate?: number } };
    return {
      ...parsed,
      monitorSpeed: parsed.monitorSpeed ?? parsed.serial?.baudRate
    };
  } catch {
    return {};
  }
}
