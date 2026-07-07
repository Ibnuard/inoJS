import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const mqttPlugin: InoPlugin = {
  name: "@inojs/mqtt",
  packageName: "@inojs/mqtt",
  symbols: ["MQTT"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "MQTT")) return false;
    context.requireBoardCapability("wifi", declaration.init);
    const cppName = context.uniqueSymbol(declaration.id.name, "mqtt");
    const wifiName = context.uniqueSymbol(declaration.id.name, "wifiClient");
    context.addInclude("WiFi.h");
    context.addInclude("PubSubClient.h");
    context.addGlobal(`WiFiClient ${wifiName};`);
    context.addGlobal(`PubSubClient ${cppName}(${wifiName});`);
    context.addLibDep("knolleary/PubSubClient");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/mqtt", cppName });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/mqtt") return undefined;
    const args = call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ");
    switch (call.callee.property.name) {
      case "setServer":
      case "connect":
      case "publish":
      case "subscribe":
      case "loop":
        return `${binding.cppName}.${call.callee.property.name}(${args})`;
      default:
        context.report({
          level: "warning",
          message: `Unsupported MQTT method: ${call.callee.property.name}`,
          node: call.callee.property
        });
        return `/* unsupported MQTT method: ${call.callee.property.name} */`;
    }
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}
