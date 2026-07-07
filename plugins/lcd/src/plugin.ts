import type { InoPlugin } from "@inojs/plugin-api";
import type { Node, VariableDeclarator } from "@babel/types";

export const lcdPlugin: InoPlugin = {
  name: "@inojs/lcd",
  packageName: "@inojs/lcd",
  symbols: ["LCD"],
  analyzeDeclaration(declaration, context) {
    if (!isLCDDeclaration(declaration)) return false;

    const name = declaration.id.name;
    const address = declaration.init.arguments[0];
    const columns = declaration.init.arguments[1];
    const rows = declaration.init.arguments[2];
    const cppName = context.uniqueSymbol(name, "lcd");
    const columnsCpp = expressionOrDefault(columns, "16", context);

    context.requireBoardCapability("i2c", declaration.init);
    context.addInclude("LiquidCrystal_I2C.h");
    context.addGlobal(`LiquidCrystal_I2C ${cppName}(${expressionOrDefault(address, "0x27", context)}, ${columnsCpp}, ${expressionOrDefault(rows, "2", context)});`);
    context.addLibDep("marcoschwartz/LiquidCrystal_I2C");
    context.bindSymbol(name, {
      plugin: "@inojs/lcd",
      cppName,
      data: {
        columns: columnsCpp
      }
    });

    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
    if (call.callee.property.type !== "Identifier") return undefined;

    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/lcd") return undefined;

    const args = call.arguments.map((argument) => context.expressionToCpp(argument)).join(", ");

    switch (call.callee.property.name) {
      case "begin":
        return `${binding.cppName}.init()`;
      case "start":
        return [
          `${binding.cppName}.init()`,
          `${binding.cppName}.backlight()`
        ].join(";\n");
      case "clear":
        return `${binding.cppName}.clear()`;
      case "line": {
        const row = call.arguments[0] ? context.expressionToCpp(call.arguments[0]) : "0";
        const value = call.arguments[1] ? context.expressionToCpp(call.arguments[1]) : '""';
        const columns = binding.data?.columns ?? "16";
        const blankLine = JSON.stringify(" ".repeat(Number.parseInt(columns, 10) || 1));
        return [
          `${binding.cppName}.setCursor(0, ${row})`,
          `${binding.cppName}.print(${blankLine})`,
          `${binding.cppName}.setCursor(0, ${row})`,
          `${binding.cppName}.print(${value})`
        ].join(";\n");
      }
      case "setCursor":
        return `${binding.cppName}.setCursor(${args})`;
      case "print":
        return `${binding.cppName}.print(${args})`;
      case "backlight":
        return `${binding.cppName}.backlight()`;
      case "noBacklight":
        return `${binding.cppName}.noBacklight()`;
      default:
        context.report({
          level: "warning",
          message: `Unsupported LCD method: ${call.callee.property.name}`,
          node: call.callee.property
        });
        return `/* unsupported LCD method: ${call.callee.property.name} */`;
    }
  }
};

function isLCDDeclaration(declaration: VariableDeclarator): declaration is VariableDeclarator & {
  id: { type: "Identifier"; name: string };
  init: { type: "NewExpression"; arguments: Node[] };
} {
  return declaration.id.type === "Identifier"
    && declaration.init?.type === "NewExpression"
    && declaration.init.callee.type === "Identifier"
    && declaration.init.callee.name === "LCD";
}

function expressionOrDefault(
  expression: Node | undefined | null,
  fallback: string,
  context: { expressionToCpp(expression: Node): string }
): string {
  return expression ? context.expressionToCpp(expression) : fallback;
}
