import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import type { File, Statement } from "@babel/types";
import { generateArduinoCpp, type Diagnostic } from "@inojs/generator";
import { parse } from "@inojs/parser";
import { generatePlatformIOIni, type PlatformIOConfig } from "@inojs/platformio";
import { InoSourceMap } from "@inojs/source-map";
import { resolveProjectPlugins } from "./plugins.js";

export type { Diagnostic } from "@inojs/generator";
export { resolveProjectPlugins } from "./plugins.js";

export interface CompileOptions {
  cwd: string;
  entry?: string;
  outDir?: string;
  platformio?: PlatformIOConfig;
}

export interface CompileResult {
  generatedCppPath: string;
  platformioIniPath: string;
  sourceMapPath: string;
  diagnostics: Diagnostic[];
}

export async function compileProject(options: CompileOptions): Promise<CompileResult> {
  const entry = options.entry ?? await findEntry(options.cwd);
  const outDir = options.outDir ?? ".ino/generated";
  const config = await readProjectConfig(options.cwd);
  const sourcePath = join(options.cwd, entry);
  const source = await readFile(sourcePath, "utf8");
  const parsed = parse(source, { filename: sourcePath });
  const platformio = {
    board: "uno",
    ...config,
    ...options.platformio
  };
  const ast = await buildProjectAst(sourcePath, parsed.ast);
  const generated = generateArduinoCpp(ast, {
    plugins: resolveProjectPlugins(ast),
    board: platformio.board
  });

  const generatedCppPath = join(options.cwd, outDir, "src/main.cpp");
  const platformioIniPath = join(options.cwd, outDir, "platformio.ini");
  const sourceMapPath = join(options.cwd, outDir, "src/main.cpp.map");

  await mkdir(dirname(generatedCppPath), { recursive: true });
  await writeFile(generatedCppPath, generated.code, "utf8");
  const sourceMap = new InoSourceMap();
  for (const mapping of generated.sourceMap) {
    sourceMap.add(mapping.generatedLine, mapping.source);
  }
  await writeFile(sourceMapPath, `${JSON.stringify(sourceMap.toJSON(), null, 2)}\n`, "utf8");
  const platformioWithDeps = {
    ...platformio,
    libDeps: unique([
      ...(config.libDeps ?? []),
      ...generated.libDeps,
      ...(options.platformio?.libDeps ?? [])
    ])
  };

  await writeFile(platformioIniPath, generatePlatformIOIni(platformioWithDeps), "utf8");

  return {
    generatedCppPath,
    platformioIniPath,
    sourceMapPath,
    diagnostics: generated.diagnostics
  };
}

async function buildProjectAst(entryPath: string, entryAst: File): Promise<File> {
  const graph = new LocalModuleGraph();
  return graph.build(entryPath, entryAst);
}

class LocalModuleGraph {
  private readonly visited = new Set<string>();
  private readonly visiting = new Set<string>();

  async build(entryPath: string, entryAst: File): Promise<File> {
    const body = await this.loadModule(resolve(entryPath), entryAst);
    entryAst.program.body = body;
    return entryAst;
  }

  private async loadModule(filename: string, ast?: File): Promise<Statement[]> {
    const resolved = resolve(filename);
    if (this.visited.has(resolved)) return [];
    if (this.visiting.has(resolved)) {
      throw new Error(`Circular local import detected at ${resolved}`);
    }

    this.visiting.add(resolved);
    const parsed = ast ?? parse(await readFile(resolved, "utf8"), { filename: resolved }).ast;
    const body: Statement[] = [];

    for (const statement of parsed.program.body) {
      if (statement.type === "ImportDeclaration" && isLocalImport(statement.source.value)) {
        const child = await resolveLocalImport(resolved, statement.source.value);
        body.push(...await this.loadModule(child));
        continue;
      }

      const normalized = normalizeExportStatement(statement);
      if (normalized) body.push(normalized);
    }

    this.visiting.delete(resolved);
    this.visited.add(resolved);
    return body;
  }
}

function isLocalImport(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

async function resolveLocalImport(importer: string, source: string): Promise<string> {
  const base = resolve(dirname(importer), source);
  const candidates = extname(base)
    ? [base]
    : [
      `${base}.ts`,
      `${base}.js`,
      join(base, "index.ts"),
      join(base, "index.js")
    ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next local module candidate.
    }
  }

  throw new Error(`Unable to resolve local import ${JSON.stringify(source)} from ${importer}`);
}

function normalizeExportStatement(statement: Statement): Statement | undefined {
  if (statement.type === "ExportNamedDeclaration") {
    if (statement.declaration) {
      statement.declaration.leadingComments ??= statement.leadingComments;
      return statement.declaration;
    }
    return undefined;
  }

  if (statement.type === "ExportDefaultDeclaration") {
    const declaration = statement.declaration;
    if (declaration.type === "FunctionDeclaration") {
      declaration.leadingComments ??= statement.leadingComments;
    }
    return declaration.type === "FunctionDeclaration" ? declaration : undefined;
  }

  if (statement.type === "ExportAllDeclaration") return undefined;

  return statement;
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
