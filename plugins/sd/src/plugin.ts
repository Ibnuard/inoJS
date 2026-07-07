import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const sdPlugin: InoPlugin = {
  name: "@inojs/sd",
  packageName: "@inojs/sd",
  symbols: ["SDCard"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "SDCard")) return false;
    const pin = declaration.init.arguments[0];
    context.validatePin(pin);
    context.addInclude("SD.h");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/sd", cppName: "SD", data: { pin: pin ? context.expressionToCpp(pin) : "10" } });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/sd") return undefined;
    const args = call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ");
    if (call.callee.property.name === "begin") return `SD.begin(${args || binding.data?.pin || "10"})`;
    return `SD.${call.callee.property.name}(${args})`;
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}
