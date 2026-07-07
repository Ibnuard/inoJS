import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const neoPixelPlugin: InoPlugin = {
  name: "@inojs/neopixel",
  packageName: "@inojs/neopixel",
  symbols: ["NeoPixel"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "NeoPixel")) return false;
    const [count, pin] = declaration.init.arguments;
    const cppName = context.uniqueSymbol(declaration.id.name, "pixels");
    context.validatePin(pin);
    context.addInclude("Adafruit_NeoPixel.h");
    context.addGlobal(`Adafruit_NeoPixel ${cppName}(${expr(count, "1", context)}, ${expr(pin, "0", context)}, NEO_GRB + NEO_KHZ800);`);
    context.addLibDep("adafruit/Adafruit NeoPixel");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/neopixel", cppName });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/neopixel") return undefined;
    const args = call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ");
    if (call.callee.property.name === "brightness") return `${binding.cppName}.setBrightness(${args})`;
    if (["begin", "show", "clear", "setPixelColor"].includes(call.callee.property.name)) return `${binding.cppName}.${call.callee.property.name}(${args})`;
    context.report({ level: "warning", message: `Unsupported NeoPixel method: ${call.callee.property.name}`, node: call.callee.property });
    return `/* unsupported NeoPixel method: ${call.callee.property.name} */`;
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}

function expr(node: Node | undefined | null, fallback: string, context: { expressionToCpp(node: Node): string }): string {
  return node ? context.expressionToCpp(node) : fallback;
}
