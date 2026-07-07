import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const eepromPlugin: InoPlugin = {
  name: "@inojs/eeprom",
  packageName: "@inojs/eeprom",
  symbols: ["EEPROMStore"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "EEPROMStore")) return false;
    context.requireBoardCapability("eeprom", declaration.init);
    context.addInclude("EEPROM.h");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/eeprom", cppName: "EEPROM" });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/eeprom") return undefined;
    const args = call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ");
    switch (call.callee.property.name) {
      case "begin":
      case "read":
      case "write":
      case "commit":
        return `EEPROM.${call.callee.property.name}(${args})`;
      default:
        context.report({
          level: "warning",
          message: `Unsupported EEPROM method: ${call.callee.property.name}`,
          node: call.callee.property
        });
        return `/* unsupported EEPROM method: ${call.callee.property.name} */`;
    }
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}
