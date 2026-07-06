import { dhtPlugin } from "@inojs/dht";
import { lcdPlugin } from "@inojs/lcd";
import { servoPlugin } from "@inojs/servo";
import type { File } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const builtInPlugins: InoPlugin[] = [
  dhtPlugin,
  lcdPlugin,
  servoPlugin
];

export function resolveProjectPlugins(ast: File, registry: InoPlugin[] = builtInPlugins): InoPlugin[] {
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
