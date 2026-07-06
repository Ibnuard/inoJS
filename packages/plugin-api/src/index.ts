import type { CallExpression, Node, VariableDeclarator } from "@babel/types";

export interface PluginBinding {
  plugin: string;
  cppName: string;
  data?: Record<string, string>;
}

export interface PluginDiagnostic {
  level: "error" | "warning";
  message: string;
  node?: Node;
}

export interface PluginContext {
  addInclude(include: string): void;
  addGlobal(code: string): void;
  addSetup(code: string): void;
  addLoop(code: string): void;
  addLibDep(dependency: string): void;
  bindSymbol(name: string, binding: PluginBinding): void;
  getBinding(name: string): PluginBinding | undefined;
  uniqueSymbol(name: string, prefix?: string): string;
  expressionToCpp(expression: Node): string;
  report(diagnostic: PluginDiagnostic): void;
}

export interface InoPlugin {
  name: string;
  packageName?: string;
  symbols?: string[];
  analyzeDeclaration?(declaration: VariableDeclarator, context: PluginContext): boolean;
  generateCall?(call: CallExpression, context: PluginContext): string | undefined;
}
