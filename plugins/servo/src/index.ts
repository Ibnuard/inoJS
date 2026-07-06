import type { InoPlugin, PluginContext } from "@inojs/plugin-api";
import type { CallExpression, Node, VariableDeclarator } from "@babel/types";

export class Servo {
  constructor(public readonly pinNumber: number) {}
  attach(pinNumber?: number): void {}
  write(angle: number): void {}
  detach(): void {}
}

export const servoPlugin: InoPlugin = {
  name: "@inojs/servo",
  analyzeDeclaration(declaration, context) {
    if (!isServoDeclaration(declaration)) return false;

    const name = declaration.id.name;
    const pin = declaration.init.arguments[0];
    const cppName = uniqueServoName(name);

    context.addInclude("Servo.h");
    context.addGlobal(`Servo ${cppName};`);
    context.addLibDep("arduino-libraries/Servo");
    context.bindSymbol(name, {
      plugin: "@inojs/servo",
      cppName,
      data: {
        pin: pin ? context.expressionToCpp(pin) : ""
      }
    });

    return true;
  },
  generateCall(call, context) {
    if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
    if (call.callee.property.type !== "Identifier") return undefined;

    const binding = context.getBinding(call.callee.object.name);
    if (binding?.plugin !== "@inojs/servo") return undefined;

    const args = call.arguments.map((argument) => context.expressionToCpp(argument)).join(", ");

    switch (call.callee.property.name) {
      case "attach": {
        const pin = args || binding.data?.pin;
        if (!pin) {
          context.report({
            level: "error",
            message: "Servo.attach() requires a pin when the Servo constructor has no pin.",
            node: call
          });
          return "/* servo attach missing pin */";
        }
        return `${binding.cppName}.attach(${pin})`;
      }
      case "write":
        return `${binding.cppName}.write(${args})`;
      case "detach":
        return `${binding.cppName}.detach()`;
      default:
        context.report({
          level: "warning",
          message: `Unsupported Servo method: ${call.callee.property.name}`,
          node: call.callee.property
        });
        return undefined;
    }
  }
};

function isServoDeclaration(declaration: VariableDeclarator): declaration is VariableDeclarator & {
  id: { type: "Identifier"; name: string };
  init: { type: "NewExpression"; arguments: Node[] };
} {
  return declaration.id.type === "Identifier"
    && declaration.init?.type === "NewExpression"
    && declaration.init.callee.type === "Identifier"
    && declaration.init.callee.name === "Servo";
}

function uniqueServoName(name: string): string {
  return `servo_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}
