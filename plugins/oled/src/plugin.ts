import type { Node, VariableDeclarator } from "@babel/types";
import type { InoPlugin } from "@inojs/plugin-api";

export const oledPlugin: InoPlugin = {
  name: "@inojs/oled",
  packageName: "@inojs/oled",
  symbols: ["OLED"],
  analyzeDeclaration(declaration, context) {
    if (!isNew(declaration, "OLED")) return false;
    const cppName = context.uniqueSymbol(declaration.id.name, "oled");
    const [width, height] = declaration.init.arguments;
    context.addInclude("Wire.h");
    context.addInclude("Adafruit_SSD1306.h");
    context.addGlobal(`Adafruit_SSD1306 ${cppName}(${expr(width, "128", context)}, ${expr(height, "64", context)}, &Wire, -1);`);
    context.addLibDep("adafruit/Adafruit SSD1306");
    context.bindSymbol(declaration.id.name, { plugin: "@inojs/oled", cppName });
    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier" || call.callee.property.type !== "Identifier") return undefined;
    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/oled") return undefined;
    const args = call.arguments.map((arg) => context.expressionToCpp(arg)).join(", ");
    if (call.callee.property.name === "begin") return `${binding.cppName}.begin(SSD1306_SWITCHCAPVCC, 0x3C)`;
    if (call.callee.property.name === "clear") return `${binding.cppName}.clearDisplay()`;
    if (call.callee.property.name === "textSize") return `${binding.cppName}.setTextSize(${args})`;
    if (call.callee.property.name === "textColor") return `${binding.cppName}.setTextColor(${args})`;
    if (["display", "setCursor", "print"].includes(call.callee.property.name)) return `${binding.cppName}.${call.callee.property.name}(${args})`;
    context.report({ level: "warning", message: `Unsupported OLED method: ${call.callee.property.name}`, node: call.callee.property });
    return `/* unsupported OLED method: ${call.callee.property.name} */`;
  }
};

function isNew(declaration: VariableDeclarator, name: string): declaration is VariableDeclarator & { id: { type: "Identifier"; name: string }; init: { type: "NewExpression"; arguments: Node[] } } {
  return declaration.id.type === "Identifier" && declaration.init?.type === "NewExpression" && declaration.init.callee.type === "Identifier" && declaration.init.callee.name === name;
}

function expr(node: Node | undefined | null, fallback: string, context: { expressionToCpp(node: Node): string }): string {
  return node ? context.expressionToCpp(node) : fallback;
}
