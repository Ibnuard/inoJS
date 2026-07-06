import type { InoPlugin } from "../packages/plugin-api/src/index.js";
import { generateArduinoCpp, type GenerateOptions } from "../packages/generator/src/index.js";
import { parse } from "../packages/parser/src/index.js";

export function generate(source: string, plugins: InoPlugin[] = [], options: Omit<GenerateOptions, "plugins"> = {}) {
  const parsed = parse(source, { filename: "src/main.js" });
  return generateArduinoCpp(parsed.ast, { ...options, plugins });
}

export function parseSource(source: string) {
  return parse(source, { filename: "src/main.js" });
}
