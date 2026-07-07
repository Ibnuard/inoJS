import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const bluetoothPlugin: InoPlugin = {
  name: "@inojs/bluetooth",
  packageName: "@inojs/bluetooth",
  symbols: ["Bluetooth"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "Bluetooth")) return false;
    const cppName = context.uniqueSymbol(declaration.id.name, "bt");
    context.addInclude("BluetoothSerial.h");
    context.addGlobal(`BluetoothSerial ${cppName};`);
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/bluetooth", cppName });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/bluetooth") return undefined;
    return `${binding.cppName}.${call.callee.property.name}(${call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ")})`;
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}
