import type { Node } from "@babel/types";
import type { InoPlugin, PluginBinding, PluginContext, PluginDiagnostic } from "@inojs/plugin-api";

export type DiagnosticLevel = "error" | "warning";

export interface Diagnostic {
  level: DiagnosticLevel;
  message: string;
  location?: DiagnosticLocation;
}

export interface DiagnosticLocation {
  filename?: string;
  line: number;
  column: number;
}

export interface Context {
  diagnostics: Diagnostic[];
  coreAliases: Set<string>;
  pins: Map<string, string>;
  serialAliases: Set<string>;
  autoSerialBegin?: string;
  hasSerialBegin: boolean;
  includes: Set<string>;
  globals: string[];
  setupContributions: string[];
  loopContributions: string[];
  libDeps: Set<string>;
  pluginBindings: Map<string, PluginBinding>;
  cppSymbols: Set<string>;
  plugins: InoPlugin[];
}

export function createContext(plugins: InoPlugin[]): Context {
  return {
    diagnostics: [],
    coreAliases: new Set(["core"]),
    pins: new Map(),
    serialAliases: new Set(),
    hasSerialBegin: false,
    includes: new Set(),
    globals: [],
    setupContributions: [],
    loopContributions: [],
    libDeps: new Set(),
    pluginBindings: new Map(),
    cppSymbols: new Set(),
    plugins
  };
}

export function createPluginContext(
  context: Context,
  expressionToCpp: (expression: Node) => string,
  report: (diagnostic: PluginDiagnostic) => void
): PluginContext {
  return {
    addInclude(include) {
      context.includes.add(include);
    },
    addGlobal(code) {
      context.globals.push(code);
    },
    addSetup(code) {
      context.setupContributions.push(code);
    },
    addLoop(code) {
      context.loopContributions.push(code);
    },
    addLibDep(dependency) {
      context.libDeps.add(dependency);
    },
    bindSymbol(name, binding) {
      context.pluginBindings.set(name, binding);
    },
    getBinding(name) {
      return context.pluginBindings.get(name);
    },
    uniqueSymbol(name, prefix) {
      return uniqueCppSymbol(context, name, prefix);
    },
    expressionToCpp,
    report
  };
}

export function uniqueCppSymbol(context: Context, name: string, prefix = "inojs"): string {
  const base = `${prefix}_${name}`.replace(/[^a-zA-Z0-9_]/g, "_");
  let candidate = base;
  let suffix = 2;
  while (context.cppSymbols.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  context.cppSymbols.add(candidate);
  return candidate;
}
