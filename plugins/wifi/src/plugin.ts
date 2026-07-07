import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const wifiPlugin: InoPlugin = {
  name: "@inojs/wifi",
  packageName: "@inojs/wifi",
  symbols: ["WiFiConnection"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "WiFiConnection")) return false;
    context.addInclude("WiFi.h");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/wifi", cppName: "WiFi" });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/wifi") return undefined;
    return `WiFi.${call.callee.property.name}(${call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ")})`;
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}
