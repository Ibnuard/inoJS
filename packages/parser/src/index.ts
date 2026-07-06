import { parse as babelParse } from "@babel/parser";
import type { File } from "@babel/types";

export interface ParseOptions {
  filename?: string;
  sourceType?: "module" | "script";
}

export interface ParseResult {
  ast: File;
}

export function parse(source: string, options: ParseOptions = {}): ParseResult {
  const ast = babelParse(source, {
    sourceFilename: options.filename,
    sourceType: options.sourceType ?? "module",
    plugins: ["typescript"],
    errorRecovery: false
  });

  return { ast };
}
