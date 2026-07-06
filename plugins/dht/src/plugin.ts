import type { InoPlugin } from "@inojs/plugin-api";
import type { Node, VariableDeclarator } from "@babel/types";

export const dhtPlugin: InoPlugin = {
  name: "@inojs/dht",
  packageName: "@inojs/dht",
  symbols: ["DHT"],
  analyzeDeclaration(declaration, context) {
    if (!isDHTDeclaration(declaration)) return false;

    const name = declaration.id.name;
    const pin = declaration.init.arguments[0];
    const type = declaration.init.arguments[1];
    const cppName = context.uniqueSymbol(name, "dht");

    if (!pin) {
      context.report({
        level: "error",
        message: "DHT constructor requires a pin.",
        node: declaration.init
      });
    }

    context.addInclude("DHT.h");
    context.addGlobal(`DHT ${cppName}(${pin ? context.expressionToCpp(pin) : "0"}, ${dhtTypeToCpp(type)});`);
    context.addLibDep("adafruit/DHT sensor library");
    context.bindSymbol(name, {
      plugin: "@inojs/dht",
      cppName
    });

    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
    if (call.callee.property.type !== "Identifier") return undefined;

    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/dht") return undefined;

    switch (call.callee.property.name) {
      case "begin":
        return `${binding.cppName}.begin()`;
      case "temperature":
      case "readTemperature":
        return `${binding.cppName}.readTemperature()`;
      case "humidity":
      case "readHumidity":
        return `${binding.cppName}.readHumidity()`;
      default:
        context.report({
          level: "warning",
          message: `Unsupported DHT method: ${call.callee.property.name}`,
          node: call.callee.property
        });
        return `/* unsupported DHT method: ${call.callee.property.name} */`;
    }
  }
};

function isDHTDeclaration(declaration: VariableDeclarator): declaration is VariableDeclarator & {
  id: { type: "Identifier"; name: string };
  init: { type: "NewExpression"; arguments: Node[] };
} {
  return declaration.id.type === "Identifier"
    && declaration.init?.type === "NewExpression"
    && declaration.init.callee.type === "Identifier"
    && declaration.init.callee.name === "DHT";
}

function dhtTypeToCpp(type: Node | null | undefined): string {
  if (!type) return "DHT22";
  if (type.type === "StringLiteral") return type.value;
  if (type.type === "Identifier") return type.name;
  return "DHT22";
}
