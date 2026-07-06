import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  File,
  Node,
  Statement
} from "@babel/types";
import type { InoPlugin, PluginDiagnostic } from "@inojs/plugin-api";
import {
  createContext,
  createPluginContext as createPluginApiContext,
  uniqueCppSymbol,
  type Context,
  type Diagnostic,
  type DiagnosticLocation
} from "./context.js";
import { validatePinExpression } from "./boards.js";

export type { Diagnostic, DiagnosticLocation } from "./context.js";

export interface GenerateResult {
  code: string;
  diagnostics: Diagnostic[];
  libDeps: string[];
}

export interface GenerateOptions {
  plugins?: InoPlugin[];
  board?: string;
}

export function generateArduinoCpp(ast: File, options: GenerateOptions = {}): GenerateResult {
  const plugins = options.plugins ?? [];
  const context = createContext(plugins, options.board);

  const setupStatements: string[] = [];
  const loopStatements: string[] = [];

  for (const statement of ast.program.body) {
    if (statement.type === "ImportDeclaration") continue;

    if (statement.type === "VariableDeclaration") {
      collectTopLevelDeclaration(statement, context, plugins);
      continue;
    }

    if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") {
      const call = statement.expression;
      if (isCoreLifecycleCall(call, "setup", context) || isCoreLifecycleCall(call, "init", context)) {
        setupStatements.push(...blockToCpp(getLifecycleBlock(call), context));
        continue;
      }
      if (isCoreLifecycleCall(call, "loop", context) || isCoreLifecycleCall(call, "app", context)) {
        loopStatements.push(...blockToCpp(getLifecycleBlock(call), context));
        continue;
      }
      if (isCoreCall(call, "every", context)) {
        loopStatements.push(...coreEveryToCpp(call, context));
        continue;
      }
      const buttonPress = buttonOnPressToCpp(call, context);
      if (buttonPress) {
        loopStatements.push(...buttonPress);
        continue;
      }
    }

    context.diagnostics.push({
      level: "warning",
      message: `Unsupported top-level statement: ${statement.type}`,
      location: locationOf(statement)
    });
  }

  const code = [
    "#include <Arduino.h>",
    ...[...context.includes].map((include) => `#include <${include}>`),
    "",
    ...context.globals,
    ...(context.globals.length ? [""] : []),
    "void setup() {",
    ...indent(setupPrologue(context)),
    ...indent(context.setupContributions),
    ...indent(setupStatements),
    "}",
    "",
    "void loop() {",
    ...indent(context.loopContributions),
    ...indent(loopStatements),
    "}",
    ""
  ].join("\n");

  return { code, diagnostics: context.diagnostics, libDeps: [...context.libDeps] };
}

function collectTopLevelDeclaration(statement: Extract<Statement, { type: "VariableDeclaration" }>, context: Context, plugins: InoPlugin[]): void {
  for (const declaration of statement.declarations) {
    if (declaration.id.type !== "Identifier" || !declaration.init) continue;

    const pluginContext = createPluginContext(context);
    if (plugins.some((plugin) => plugin.analyzeDeclaration?.(declaration, pluginContext))) {
      continue;
    }

    const factoryOptions = getInoFactoryOptions(declaration.init, context);
    if (factoryOptions.isFactory) {
      context.coreAliases.add(declaration.id.name);
      if (factoryOptions.autoSerialBegin) {
        context.autoSerialBegin = factoryOptions.autoSerialBegin;
      }
      continue;
    }

    const pin = getCoreCallArgument(declaration.init, "pin", context) ?? getCoreCallArgument(declaration.init, "led", context);
    if (pin) {
      validatePin(pin, context);
      context.pins.set(declaration.id.name, expressionToCpp(pin, context));
      continue;
    }

    const button = getButtonBinding(declaration.init, context);
    if (button) {
      context.buttons.set(declaration.id.name, button);
      continue;
    }

    if (isCoreCall(declaration.init, "serial", context)) {
      context.serialAliases.add(declaration.id.name);
      continue;
    }

    context.globals.push(`auto ${declaration.id.name} = ${expressionToCpp(declaration.init, context)};`);
  }
}

function blockToCpp(block: BlockStatement | undefined, context: Context): string[] {
  if (!block) return [];
  return block.body.flatMap((statement) => statementToCpp(statement, context));
}

function statementToCpp(statement: Statement, context: Context): string[] {
  if (statement.type === "ExpressionStatement") {
    if (statement.expression.type === "CallExpression") {
      if (isCoreCall(statement.expression, "every", context)) {
        return coreEveryToCpp(statement.expression, context);
      }
      if (isCoreCall(statement.expression, "log", context)) {
        return coreLogToCpp(statement.expression, context);
      }
      const serialLog = serialLogCallToCpp(statement.expression, context);
      if (serialLog) return serialLog;
      const buttonPress = buttonOnPressToCpp(statement.expression, context);
      if (buttonPress) return buttonPress;
    }
    return cppStatementLines(expressionStatementToCpp(statement.expression, context));
  }

  if (statement.type === "VariableDeclaration") {
    return statement.declarations.map((declaration) => {
      if (declaration.id.type !== "Identifier") {
        unsupported(context, `Unsupported declaration target: ${declaration.id.type}`, declaration.id);
        return "";
      }
      const value = declaration.init ? expressionToCpp(declaration.init, context) : "0";
      return `auto ${declaration.id.name} = ${value};`;
    }).filter(Boolean);
  }

  if (statement.type === "IfStatement") {
    const test = expressionToCpp(statement.test, context);
    const consequent = statement.consequent.type === "BlockStatement"
      ? blockToCpp(statement.consequent, context)
      : statementToCpp(statement.consequent, context);
    const lines = [`if (${test}) {`, ...indent(consequent), "}"];
    if (statement.alternate) {
      const alternate = statement.alternate.type === "BlockStatement"
        ? blockToCpp(statement.alternate, context)
        : statementToCpp(statement.alternate, context);
      lines.push("else {", ...indent(alternate), "}");
    }
    return lines;
  }

  if (statement.type === "ReturnStatement") {
    return statement.argument ? [`return ${expressionToCpp(statement.argument, context)};`] : ["return;"];
  }

  unsupported(context, `Unsupported statement in setup/loop: ${statement.type}`, statement);
  return [];
}

function expressionStatementToCpp(expression: Expression, context: Context): string {
  if (expression.type === "CallExpression") {
    const pluginCall = pluginMethodCall(expression, context);
    if (pluginCall) return pluginCall;

    const pinCall = pinMethodCall(expression, context);
    if (pinCall) return pinCall;

    const serialCall = serialMethodCall(expression, context);
    if (serialCall) return serialCall;

    const buttonCall = buttonMethodCall(expression, context);
    if (buttonCall) return buttonCall;
  }

  return expressionToCpp(expression, context);
}

function expressionToCpp(expression: Node, context: Context): string {
  switch (expression.type) {
    case "NumericLiteral":
      return String(expression.value);
    case "StringLiteral":
      return JSON.stringify(expression.value);
    case "TemplateLiteral":
      return templateLiteralToCpp(expression, context);
    case "BooleanLiteral":
      return expression.value ? "true" : "false";
    case "Identifier":
      return expression.name;
    case "MemberExpression":
      return memberExpressionToCpp(expression, context);
    case "BinaryExpression":
    case "LogicalExpression":
      return `${expressionToCpp(expression.left, context)} ${expression.operator} ${expressionToCpp(expression.right, context)}`;
    case "UnaryExpression":
      return `${expression.operator}${expressionToCpp(expression.argument, context)}`;
    case "UpdateExpression": {
      const argument = expressionToCpp(expression.argument, context);
      return expression.prefix ? `${expression.operator}${argument}` : `${argument}${expression.operator}`;
    }
    case "AssignmentExpression":
      return `${expressionToCpp(expression.left, context)} ${expression.operator} ${expressionToCpp(expression.right, context)}`;
    case "CallExpression": {
      const pluginCall = pluginMethodCall(expression, context);
      if (pluginCall) return pluginCall;
      const analogRead = analogReadExpression(expression, context);
      if (analogRead) return analogRead;
      const pinRead = pinReadExpression(expression, context);
      if (pinRead) return pinRead;
      const buttonRead = buttonReadExpression(expression, context);
      if (buttonRead) return buttonRead;
      const coreDelay = getCoreCallArgument(expression, "delay", context);
      if (coreDelay) return `delay(${expressionToCpp(coreDelay, context)})`;
      if (isCoreCall(expression, "millis", context)) return "millis()";
      if (isCoreCall(expression, "micros", context)) return "micros()";
      if (isCoreCall(expression, "log", context)) {
        unsupported(context, "core.log() can only be used as a statement.", expression);
        return "/* unsupported core.log */";
      }
      if (isIdentifierCall(expression, "delay")) return `delay(${joinArgs(expression, context)})`;
      if (isIdentifierCall(expression, "millis")) return "millis()";
      if (isIdentifierCall(expression, "micros")) return "micros()";
      unsupported(context, "Unsupported function call expression", expression);
      return "/* unsupported call */";
    }
    default:
      unsupported(context, `Unsupported expression: ${expression.type}`, expression);
      return "/* unsupported */";
  }
}

function pluginMethodCall(call: CallExpression, context: Context): string | undefined {
  const pluginContext = createPluginContext(context);
  for (const plugin of context.plugins) {
    const generated = plugin.generateCall?.(call, pluginContext);
    if (generated) return generated;
  }
  return undefined;
}

function pinReadExpression(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "read") return undefined;

  const pin = context.pins.get(call.callee.object.name);
  return pin ? `digitalRead(${pin})` : undefined;
}

function pinMethodCall(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier") return undefined;

  const pin = context.pins.get(call.callee.object.name);
  if (!pin) return undefined;

  switch (call.callee.property.name) {
    case "output":
      return `pinMode(${pin}, OUTPUT)`;
    case "input":
      return `pinMode(${pin}, INPUT)`;
    case "inputPullup":
      return `pinMode(${pin}, INPUT_PULLUP)`;
    case "high":
    case "on":
      return `digitalWrite(${pin}, HIGH)`;
    case "low":
    case "off":
      return `digitalWrite(${pin}, LOW)`;
    case "toggle":
      return `digitalWrite(${pin}, !digitalRead(${pin}))`;
    case "write":
      return `digitalWrite(${pin}, ${pinWriteValue(call, context)})`;
    case "analogWrite":
    case "pwm":
      return `analogWrite(${pin}, ${joinArgs(call, context)})`;
    default:
      unsupported(context, `Unsupported pin method: ${call.callee.property.name}`, call.callee.property);
      return undefined;
  }
}

function serialMethodCall(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.property.type !== "Identifier") return undefined;

  const object = call.callee.object;
  const isSerialAlias = object.type === "Identifier" && context.serialAliases.has(object.name);
  const isCoreSerial = object.type === "CallExpression" && isCoreCall(object, "serial", context);
  if (!isSerialAlias && !isCoreSerial) return undefined;

  switch (call.callee.property.name) {
    case "begin":
      context.hasSerialBegin = true;
      return `Serial.begin(${joinArgs(call, context)})`;
    case "print":
      return `Serial.print(${joinArgs(call, context)})`;
    case "println":
      return `Serial.println(${joinArgs(call, context)})`;
    default:
      unsupported(context, `Unsupported serial method: ${call.callee.property.name}`, call.callee.property);
      return undefined;
  }
}

function buttonMethodCall(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier") return undefined;

  const button = context.buttons.get(call.callee.object.name);
  if (!button) return undefined;

  switch (call.callee.property.name) {
    case "init":
      return `pinMode(${button.pin}, ${button.mode})`;
    default:
      unsupported(context, `Unsupported button method: ${call.callee.property.name}`, call.callee.property);
      return undefined;
  }
}

function buttonReadExpression(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "isPressed") return undefined;

  const button = context.buttons.get(call.callee.object.name);
  return button ? `digitalRead(${button.pin}) == ${button.pressedLevel}` : undefined;
}

function buttonOnPressToCpp(call: CallExpression, context: Context): string[] | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "onPress") return undefined;

  const buttonName = call.callee.object.name;
  const button = context.buttons.get(buttonName);
  if (!button) return undefined;

  const callback = call.arguments[0];
  if (!callback || callback.type !== "ArrowFunctionExpression") {
    unsupported(context, "button.onPress() expects a callback.", call);
    return ["/* unsupported button.onPress */"];
  }

  const block = arrowBodyToBlock(callback);
  if (!block) {
    unsupported(context, "button.onPress() expects a block callback.", callback);
    return ["/* unsupported button.onPress */"];
  }

  const previousSymbol = uniqueCppSymbol(context, `${buttonName}_pressed`, "inojs_button");
  const currentSymbol = uniqueCppSymbol(context, `${buttonName}_current`, "inojs_button");
  context.globals.push(`bool ${previousSymbol} = false;`);

  return [
    `bool ${currentSymbol} = digitalRead(${button.pin}) == ${button.pressedLevel};`,
    `if (${currentSymbol} && !${previousSymbol}) {`,
    ...indent(blockToCpp(block, context)),
    "}",
    `${previousSymbol} = ${currentSymbol};`
  ];
}

function isCoreLifecycleCall(call: CallExpression, name: "setup" | "loop" | "init" | "app", context: Context): boolean {
  return call.callee.type === "MemberExpression"
    && call.callee.object.type === "Identifier"
    && context.coreAliases.has(call.callee.object.name)
    && call.callee.property.type === "Identifier"
    && call.callee.property.name === name;
}

function getLifecycleBlock(call: CallExpression): BlockStatement | undefined {
  const callback = call.arguments[0];
  if (!callback || callback.type !== "ArrowFunctionExpression") return undefined;
  return arrowBodyToBlock(callback);
}

function arrowBodyToBlock(callback: ArrowFunctionExpression): BlockStatement | undefined {
  return callback.body.type === "BlockStatement" ? callback.body : undefined;
}

function getCoreCallArgument(expression: Node, name: string, context: Context): Node | undefined {
  if (!isCoreCall(expression, name, context) || expression.type !== "CallExpression") return undefined;
  return expression.arguments[0];
}

function getCoreCallArguments(expression: Node, name: string, context: Context): Node[] | undefined {
  if (!isCoreCall(expression, name, context) || expression.type !== "CallExpression") return undefined;
  return expression.arguments;
}

function isCoreCall(expression: Node, name: string, context: Context): boolean {
  return expression.type === "CallExpression"
    && expression.callee.type === "MemberExpression"
    && expression.callee.object.type === "Identifier"
    && context.coreAliases.has(expression.callee.object.name)
    && expression.callee.property.type === "Identifier"
    && expression.callee.property.name === name;
}

function getInoFactoryOptions(expression: Node, context: Context): { isFactory: boolean; autoSerialBegin?: string } {
  if (expression.type === "CallExpression") {
    if (expression.callee.type !== "Identifier" || expression.callee.name !== "init") return { isFactory: false };
    return { isFactory: true, autoSerialBegin: getAutoSerialBegin(expression.arguments[0], context) };
  }

  if (expression.type === "NewExpression") {
    if (expression.callee.type !== "Identifier" || !["Ino", "Core", "Board"].includes(expression.callee.name)) {
      return { isFactory: false };
    }
    return { isFactory: true, autoSerialBegin: getAutoSerialBegin(expression.arguments[0], context) };
  }

  return { isFactory: false };
}

function getAutoSerialBegin(argument: Node | undefined | null, context: Context): string | undefined {
  if (!argument || argument.type !== "ObjectExpression") return undefined;

  let serialMonitor = false;
  let baudRate: string | undefined;

  for (const property of argument.properties) {
    if (property.type !== "ObjectProperty" || property.key.type !== "Identifier") continue;
    if (property.key.name === "serialMonitor" && property.value.type === "BooleanLiteral") {
      serialMonitor = property.value.value;
    }
    if (property.key.name === "baudRate") {
      baudRate = expressionToCpp(property.value, context);
    }
  }

  if (!serialMonitor && !baudRate) return undefined;
  return baudRate ?? "115200";
}

function getButtonBinding(expression: Node, context: Context) {
  const args = getCoreCallArguments(expression, "button", context);
  if (!args) return undefined;

  const pin = args[0];
  const options = args[1];
  const pullup = getBooleanOption(options, "pullup");
  validatePin(pin, context);

  return {
    pin: pin ? expressionToCpp(pin, context) : "0",
    mode: pullup ? "INPUT_PULLUP" as const : "INPUT" as const,
    pressedLevel: pullup ? "LOW" as const : "HIGH" as const
  };
}

function getBooleanOption(expression: Node | undefined | null, name: string): boolean {
  if (!expression || expression.type !== "ObjectExpression") return false;

  for (const property of expression.properties) {
    if (property.type !== "ObjectProperty" || property.key.type !== "Identifier") continue;
    if (property.key.name === name && property.value.type === "BooleanLiteral") return property.value.value;
  }

  return false;
}

function pinWriteValue(call: CallExpression, context: Context): string {
  const value = call.arguments[0];
  if (!value) return "LOW";
  const generated = expressionToCpp(value, context);
  if (generated === "true" || generated === "1") return "HIGH";
  if (generated === "false" || generated === "0") return "LOW";
  return generated;
}

function analogReadExpression(call: CallExpression, context: Context): string | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.object.type !== "Identifier") return undefined;
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "analogRead") return undefined;

  const pin = context.pins.get(call.callee.object.name);
  return pin ? `analogRead(${pin})` : undefined;
}

function isIdentifierCall(expression: CallExpression, name: string): boolean {
  return expression.callee.type === "Identifier" && expression.callee.name === name;
}

function joinArgs(call: CallExpression, context: Context): string {
  return call.arguments.map((argument) => expressionToCpp(argument, context)).join(", ");
}

function cppStatementLines(code: string): string[] {
  return code.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.endsWith(";") || trimmed.endsWith("{") || trimmed.endsWith("}")) return line;
    return `${line};`;
  });
}

function coreEveryToCpp(call: CallExpression, context: Context): string[] {
  const schedule = getEverySchedule(call, context);
  if (!schedule) {
    unsupported(context, "core.every() expects (ms, callback) or (name, ms, callback).", call);
    return ["/* unsupported core.every */"];
  }

  const lastRunSymbol = uniqueCppSymbol(context, schedule.name, "inojs_every");
  context.globals.push(`unsigned long ${lastRunSymbol} = 0;`);

  return [
    `if (millis() - ${lastRunSymbol} >= ${schedule.interval}) {`,
    ...indent([
      `${lastRunSymbol} = millis();`,
      ...blockToCpp(schedule.block, context)
    ]),
    "}"
  ];
}

function getEverySchedule(
  call: CallExpression,
  context: Context
): { name: string; interval: string; block: BlockStatement } | undefined {
  const [first, second, third] = call.arguments;
  const hasName = first?.type === "StringLiteral";
  const name = hasName ? first.value : "task";
  const intervalNode = hasName ? second : first;
  const callback = hasName ? third : second;

  if (!intervalNode || !callback || callback.type !== "ArrowFunctionExpression") return undefined;
  const block = arrowBodyToBlock(callback);
  if (!block) return undefined;

  return {
    name,
    interval: expressionToCpp(intervalNode, context),
    block
  };
}

function coreLogToCpp(call: CallExpression, context: Context): string[] {
  context.autoSerialBegin ??= "115200";

  return serialLogToCpp(call, context, { separator: " " });
}

function serialLogCallToCpp(call: CallExpression, context: Context): string[] | undefined {
  if (call.callee.type !== "MemberExpression" || call.callee.property.type !== "Identifier") return undefined;
  if (call.callee.property.name !== "log") return undefined;

  const object = call.callee.object;
  const isSerialAlias = object.type === "Identifier" && context.serialAliases.has(object.name);
  const isCoreSerial = object.type === "CallExpression" && isCoreCall(object, "serial", context);
  if (!isSerialAlias && !isCoreSerial) return undefined;

  context.autoSerialBegin ??= "115200";
  return serialLogToCpp(call, context);
}

function serialLogToCpp(call: CallExpression, context: Context, options: { separator?: string } = {}): string[] {
  if (!call.arguments.length) return ["Serial.println();"];

  const lines: string[] = [];
  for (let index = 0; index < call.arguments.length; index += 1) {
    const argument = expressionToCpp(call.arguments[index], context);
    const isLast = index === call.arguments.length - 1;
    lines.push(`${isLast ? "Serial.println" : "Serial.print"}(${argument});`);
    if (!isLast && options.separator !== undefined) lines.push(`Serial.print(${JSON.stringify(options.separator)});`);
  }
  return lines;
}

function templateLiteralToCpp(expression: Extract<Node, { type: "TemplateLiteral" }>, context: Context): string {
  const parts: string[] = [];

  for (let index = 0; index < expression.quasis.length; index += 1) {
    const text = expression.quasis[index].value.cooked ?? expression.quasis[index].value.raw;
    if (text) parts.push(JSON.stringify(text));

    const embeddedExpression = expression.expressions[index];
    if (embeddedExpression) parts.push(expressionToCpp(embeddedExpression, context));
  }

  if (!parts.length) return '""';
  return parts.map((part, index) => index === 0 ? part : `String(${part})`).join(" + ");
}

function memberExpressionToCpp(expression: Extract<Node, { type: "MemberExpression" }>, context: Context): string {
  const object = expressionToCpp(expression.object, context);
  if (expression.property.type === "Identifier" && !expression.computed) return `${object}.${expression.property.name}`;
  return `${object}[${expressionToCpp(expression.property, context)}]`;
}

function indent(lines: string[]): string[] {
  return lines.map((line) => line ? `  ${line}` : line);
}

function setupPrologue(context: Context): string[] {
  if (!context.autoSerialBegin || context.hasSerialBegin) return [];
  return [`Serial.begin(${context.autoSerialBegin});`];
}

function unsupported(context: Context, message: string, node?: Node): void {
  context.diagnostics.push({ level: "warning", message, location: locationOf(node) });
}

function createPluginContext(context: Context) {
  return createPluginApiContext(
    context,
    (expression) => expressionToCpp(expression, context),
    (expression) => validatePin(expression, context),
    (diagnostic) => reportPluginDiagnostic(context, diagnostic)
  );
}

function validatePin(expression: Node | undefined | null, context: Context): void {
  validatePinExpression(expression, context, locationOf);
}

function reportPluginDiagnostic(context: Context, diagnostic: PluginDiagnostic): void {
  context.diagnostics.push({
    level: diagnostic.level,
    message: diagnostic.message,
    location: locationOf(diagnostic.node)
  });
}

function locationOf(node: Node | undefined): DiagnosticLocation | undefined {
  if (!node?.loc) return undefined;
  return {
    filename: node.loc.filename,
    line: node.loc.start.line,
    column: node.loc.start.column + 1
  };
}
