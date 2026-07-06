import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dhtPlugin } from "@inojs/dht";
import { generateArduinoCpp, type Diagnostic } from "@inojs/generator";
import { parse } from "@inojs/parser";
import { generatePlatformIOIni, type PlatformIOConfig } from "@inojs/platformio";
import { servoPlugin } from "@inojs/servo";
import type { File } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

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
  const generated = generateArduinoCpp(parsed.ast, { plugins: resolveProjectPlugins(parsed.ast) });

  const generatedCppPath = join(options.cwd, outDir, "src/main.cpp");
  const platformioIniPath = join(options.cwd, outDir, "platformio.ini");

  await mkdir(dirname(generatedCppPath), { recursive: true });
  await writeFile(generatedCppPath, generated.code, "utf8");
  const platformio = {
    board: "uno",
    ...config,
    ...options.platformio,
    libDeps: unique([
      ...(config.libDeps ?? []),
      ...generated.libDeps,
      ...(options.platformio?.libDeps ?? [])
    ])
  };

  await writeFile(platformioIniPath, generatePlatformIOIni(platformio), "utf8");

  return {
    generatedCppPath,
    platformioIniPath,
    diagnostics: generated.diagnostics
  };
}

const pluginRegistry: InoPlugin[] = [
  dhtPlugin,
  servoPlugin
];

export function resolveProjectPlugins(ast: File, registry: InoPlugin[] = pluginRegistry): InoPlugin[] {
  const imports = new Map<string, Set<string>>();

  for (const statement of ast.program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const source = statement.source.value;
    const symbols = imports.get(source) ?? new Set<string>();

    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported;
        symbols.add(imported.type === "Identifier" ? imported.name : imported.value);
      } else if (specifier.type === "ImportDefaultSpecifier") {
        symbols.add("default");
      } else if (specifier.type === "ImportNamespaceSpecifier") {
        symbols.add("*");
      }
    }

    imports.set(source, symbols);
  }

  return registry.filter((plugin) => {
    const packageName = plugin.packageName ?? plugin.name;
    const importedSymbols = imports.get(packageName);
    if (!importedSymbols) return false;
    if (!plugin.symbols?.length) return true;
    return plugin.symbols.some((symbol) => importedSymbols.has(symbol) || importedSymbols.has("*"));
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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
