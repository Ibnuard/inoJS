import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  File,
  ForStatement,
  FunctionDeclaration,
  Node,
  Statement,
  SwitchCase,
  SwitchStatement,
  VariableDeclarator
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
import { requireBoardCapability, validateAnalogPinExpression, validatePinExpression, validatePwmPinExpression } from "./boards.js";

export type { Diagnostic, DiagnosticLocation } from "./context.js";

export interface GenerateResult {
  code: string;
  diagnostics: Diagnostic[];
  libDeps: string[];
  sourceMap: SourceLineMapping[];
}

export interface GenerateOptions {
  plugins?: InoPlugin[];
  board?: string;
}

export interface SourceLineMapping {
  generatedLine: number;
  source: DiagnosticLocation;
}

interface CppLine {
  code: string;
  source?: DiagnosticLocation;
}

export function generateArduinoCpp(ast: File, options: GenerateOptions = {}): GenerateResult {
  const plugins = options.plugins ?? [];
  const context = createContext(plugins, options.board);

  const functionDeclarations: CppLine[] = [];
  const setupStatements: CppLine[] = [];
  const loopStatements: CppLine[] = [];

  for (const statement of ast.program.body) {
    if (statement.type === "ImportDeclaration") continue;

    if (statement.type === "FunctionDeclaration") {
      functionDeclarations.push(...collectFunctionDeclaration(statement, context));
      continue;
    }

    if (statement.type === "VariableDeclaration") {
      collectTopLevelDeclaration(statement, context, plugins);
      continue;
    }

    if (statement.type === "ExpressionStatement" && statement.expression.type === "CallExpression") {
      const call = statement.expression;
      if (isCoreLifecycleCall(call, "setup", context) || isCoreLifecycleCall(call, "init", context)) {
        setupStatements.push(...blockToMappedCpp(getLifecycleBlock(call), context));
        continue;
      }
      if (isCoreLifecycleCall(call, "loop", context) || isCoreLifecycleCall(call, "app", context)) {
        loopStatements.push(...blockToMappedCpp(getLifecycleBlock(call), context));
        continue;
      }
      if (isCoreCall(call, "every", context)) {
        loopStatements.push(...mapLines(coreEveryToCpp(call, context), call));
        continue;
      }
      const buttonPress = buttonOnPressToCpp(call, context);
      if (buttonPress) {
        loopStatements.push(...mapLines(buttonPress, call));
        continue;
      }
    }

    context.diagnostics.push({
      level: "warning",
      message: `Unsupported top-level statement: ${statement.type}`,
      location: locationOf(statement)
    });
  }

  const lines: CppLine[] = [
    line("#include <Arduino.h>"),
    ...[...context.includes].map((include) => line(`#include <${include}>`)),
    line(""),
    ...context.globals.map((global) => line(global)),
    ...((context.globals.length && functionDeclarations.length) ? [line("")] : []),
    ...functionDeclarations,
    ...((context.globals.length || functionDeclarations.length) ? [line("")] : []),
    line("void setup() {"),
    ...indentMapped(mapLines(setupPrologue(context))),
    ...indentMapped(mapLines(context.setupContributions)),
    ...indentMapped(setupStatements),
    line("}"),
    line(""),
    line("void loop() {"),
    ...indentMapped(mapLines(context.loopContributions)),
    ...indentMapped(loopStatements),
    line("}"),
    line("")
  ];
  const code = lines.map((generatedLine) => generatedLine.code).join("\n");
  const sourceMap = lines.flatMap((generatedLine, index): SourceLineMapping[] => (
    generatedLine.source ? [{ generatedLine: index + 1, source: generatedLine.source }] : []
  ));

  return { code, diagnostics: context.diagnostics, libDeps: [...context.libDeps], sourceMap };
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
      context.pinNodes.set(declaration.id.name, pin);
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

    context.globals.push(declarationToCpp(declaration, context));
  }
}

function collectFunctionDeclaration(statement: FunctionDeclaration, context: Context): CppLine[] {
  if (!statement.id) {
    unsupported(context, "Function declarations must have a name.", statement);
    return [];
  }

  const parameters = statement.params.map((parameter) => parameterToCpp(parameter, context, statement)).join(", ");
  const returnType = functionReturnType(statement, context);
  const body = blockToMappedCpp(statement.body, context);

  return [
    line(`${returnType} ${statement.id.name}(${parameters}) {`, statement),
    ...indentMapped(body),
    line("}", statement)
  ];
}

function blockToCpp(block: BlockStatement | undefined, context: Context): string[] {
  if (!block) return [];
  return block.body.flatMap((statement) => statementToCpp(statement, context));
}

function blockToMappedCpp(block: BlockStatement | undefined, context: Context): CppLine[] {
  if (!block) return [];
  return block.body.flatMap((statement) => statementToMappedCpp(statement, context));
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
      return declarationToCpp(declaration, context);
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

  if (statement.type === "ForStatement") {
    return forStatementToCpp(statement, context);
  }

  if (statement.type === "WhileStatement") {
    const body = statement.body.type === "BlockStatement"
      ? blockToCpp(statement.body, context)
      : statementToCpp(statement.body, context);
    return [
      `while (${expressionToCpp(statement.test, context)}) {`,
      ...indent(body),
      "}"
    ];
  }

  if (statement.type === "SwitchStatement") {
    return switchStatementToCpp(statement, context);
  }

  if (statement.type === "BreakStatement") return ["break;"];

  if (statement.type === "ContinueStatement") return ["continue;"];

  if (statement.type === "ReturnStatement") {
    return statement.argument ? [`return ${expressionToCpp(statement.argument, context)};`] : ["return;"];
  }

  unsupported(context, `Unsupported statement in setup/loop: ${statement.type}`, statement);
  return [];
}

function statementToMappedCpp(statement: Statement, context: Context): CppLine[] {
  if (statement.type === "IfStatement") {
    const test = expressionToCpp(statement.test, context);
    const consequent = statement.consequent.type === "BlockStatement"
      ? blockToMappedCpp(statement.consequent, context)
      : statementToMappedCpp(statement.consequent, context);
    const lines = [
      line(`if (${test}) {`, statement),
      ...indentMapped(consequent),
      line("}", statement)
    ];
    if (statement.alternate) {
      const alternate = statement.alternate.type === "BlockStatement"
        ? blockToMappedCpp(statement.alternate, context)
        : statementToMappedCpp(statement.alternate, context);
      lines.push(line("else {", statement), ...indentMapped(alternate), line("}", statement));
    }
    return lines;
  }

  if (statement.type === "ForStatement") {
    const init = statement.init ? forInitToCpp(statement.init, context) : "";
    const test = statement.test ? expressionToCpp(statement.test, context) : "";
    const update = statement.update ? expressionToCpp(statement.update, context) : "";
    const body = statement.body.type === "BlockStatement"
      ? blockToMappedCpp(statement.body, context)
      : statementToMappedCpp(statement.body, context);

    return [
      line(`for (${init}; ${test}; ${update}) {`, statement),
      ...indentMapped(body),
      line("}", statement)
    ];
  }

  if (statement.type === "WhileStatement") {
    const body = statement.body.type === "BlockStatement"
      ? blockToMappedCpp(statement.body, context)
      : statementToMappedCpp(statement.body, context);
    return [
      line(`while (${expressionToCpp(statement.test, context)}) {`, statement),
      ...indentMapped(body),
      line("}", statement)
    ];
  }

  if (statement.type === "SwitchStatement") {
    return switchStatementToMappedCpp(statement, context);
  }

  return mapLines(statementToCpp(statement, context), statement);
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
    case "ArrayExpression":
      return arrayExpressionToCpp(expression, context);
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
      if (expression.callee.type === "Identifier") return `${expression.callee.name}(${joinArgs(expression, context)})`;
      unsupported(context, "Unsupported function call expression", expression);
      return "/* unsupported call */";
    }
    default:
      unsupported(context, `Unsupported expression: ${expression.type}`, expression);
      return "/* unsupported */";
  }
}

function declarationToCpp(declaration: VariableDeclarator, context: Context): string {
  if (declaration.id.type !== "Identifier") {
    unsupported(context, `Unsupported declaration target: ${declaration.id.type}`, declaration.id);
    return "";
  }
  if (declaration.init?.type === "ArrayExpression") {
    return `${arrayElementType(declaration.init, context)} ${declaration.id.name}[] = ${arrayExpressionToCpp(declaration.init, context)};`;
  }
  const value = declaration.init ? expressionToCpp(declaration.init, context) : "0";
  return `${inferDeclarationType(declaration, context)} ${declaration.id.name} = ${value};`;
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
      validatePwmPin(call.callee.object.name, context);
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
  validateAnalogPin(call.callee.object.name, context);
  return pin ? `analogRead(${pin})` : undefined;
}

function validateAnalogPin(name: string, context: Context): void {
  validateAnalogPinExpression(context.pinNodes.get(name), context, locationOf);
}

function validatePwmPin(name: string, context: Context): void {
  validatePwmPinExpression(context.pinNodes.get(name), context, locationOf);
}

function isIdentifierCall(expression: CallExpression, name: string): boolean {
  return expression.callee.type === "Identifier" && expression.callee.name === name;
}

function forStatementToCpp(statement: ForStatement, context: Context): string[] {
  const init = statement.init ? forInitToCpp(statement.init, context) : "";
  const test = statement.test ? expressionToCpp(statement.test, context) : "";
  const update = statement.update ? expressionToCpp(statement.update, context) : "";
  const body = statement.body.type === "BlockStatement"
    ? blockToCpp(statement.body, context)
    : statementToCpp(statement.body, context);

  return [
    `for (${init}; ${test}; ${update}) {`,
    ...indent(body),
    "}"
  ];
}

function forInitToCpp(init: ForStatement["init"], context: Context): string {
  if (!init) return "";
  if (init.type === "VariableDeclaration") {
    if (init.declarations.length !== 1) {
      unsupported(context, "for loops support a single initializer declaration.", init);
      return "/* unsupported for init */";
    }
    const declaration = init.declarations[0];
    if (declaration.id.type !== "Identifier") {
      unsupported(context, `Unsupported for loop declaration target: ${declaration.id.type}`, declaration.id);
      return "/* unsupported for init */";
    }
    const value = declaration.init ? expressionToCpp(declaration.init, context) : "0";
    return `${inferDeclarationType(declaration, context)} ${declaration.id.name} = ${value}`;
  }
  return expressionToCpp(init, context);
}

function switchStatementToCpp(statement: SwitchStatement, context: Context): string[] {
  return [
    `switch (${expressionToCpp(statement.discriminant, context)}) {`,
    ...indent(statement.cases.flatMap((switchCase) => switchCaseToCpp(switchCase, context))),
    "}"
  ];
}

function switchStatementToMappedCpp(statement: SwitchStatement, context: Context): CppLine[] {
  return [
    line(`switch (${expressionToCpp(statement.discriminant, context)}) {`, statement),
    ...indentMapped(statement.cases.flatMap((switchCase) => switchCaseToMappedCpp(switchCase, context))),
    line("}", statement)
  ];
}

function switchCaseToCpp(switchCase: SwitchCase, context: Context): string[] {
  const header = switchCase.test ? `case ${expressionToCpp(switchCase.test, context)}:` : "default:";
  return [
    header,
    ...indent(switchCase.consequent.flatMap((statement) => statementToCpp(statement, context)))
  ];
}

function switchCaseToMappedCpp(switchCase: SwitchCase, context: Context): CppLine[] {
  const header = switchCase.test ? `case ${expressionToCpp(switchCase.test, context)}:` : "default:";
  return [
    line(header, switchCase),
    ...indentMapped(switchCase.consequent.flatMap((statement) => statementToMappedCpp(statement, context)))
  ];
}

function parameterToCpp(parameter: FunctionDeclaration["params"][number], context: Context, statement: FunctionDeclaration): string {
  if (parameter.type !== "Identifier") {
    unsupported(context, `Unsupported function parameter: ${parameter.type}`, parameter);
    return "double /* unsupported */";
  }

  const type = typeAnnotationToCpp(getTsTypeAnnotation(parameter.typeAnnotation), context)
    ?? jsDocTypeToCpp(getJsDocParamType(statement, parameter.name));
  if (!type) {
    unsupported(context, `Function parameter ${parameter.name} should declare a type for stable C++ generation.`, parameter);
  }

  return `${type ?? "double"} ${parameter.name}`;
}

function functionReturnType(statement: FunctionDeclaration, context: Context): string {
  const annotation = typeAnnotationToCpp(getTsTypeAnnotation(statement.returnType), context);
  if (annotation) return annotation;
  const jsDocReturn = jsDocTypeToCpp(getJsDocReturnType(statement));
  if (jsDocReturn) return jsDocReturn;
  const inferred = inferFunctionReturnType(statement.body, context);
  if (inferred) return inferred;
  if (!functionHasReturnValue(statement.body)) return "void";

  unsupported(context, `Function ${statement.id?.name ?? "<anonymous>"} should declare a return type for stable C++ generation.`, statement);
  return "auto";
}

function inferFunctionReturnType(block: BlockStatement, context: Context): string | undefined {
  for (const statement of block.body) {
    if (statement.type === "ReturnStatement" && statement.argument) {
      const inferred = inferExpressionType(statement.argument, context);
      if (inferred) return inferred;
    }
    if (statement.type === "IfStatement") {
      if (statement.consequent.type === "BlockStatement") {
        const inferred = inferFunctionReturnType(statement.consequent, context);
        if (inferred) return inferred;
      }
      if (statement.alternate?.type === "BlockStatement") {
        const inferred = inferFunctionReturnType(statement.alternate, context);
        if (inferred) return inferred;
      }
    }
  }
  return undefined;
}

function functionHasReturnValue(block: BlockStatement): boolean {
  return block.body.some((statement) => {
    if (statement.type === "ReturnStatement") return Boolean(statement.argument);
    if (statement.type === "IfStatement") {
      const consequent = statement.consequent.type === "BlockStatement"
        ? functionHasReturnValue(statement.consequent)
        : statement.consequent.type === "ReturnStatement" && Boolean(statement.consequent.argument);
      const alternate = statement.alternate
        ? statement.alternate.type === "BlockStatement"
          ? functionHasReturnValue(statement.alternate)
          : statement.alternate.type === "ReturnStatement" && Boolean(statement.alternate.argument)
        : false;
      return consequent || alternate;
    }
    return false;
  });
}

function getTsTypeAnnotation(annotation: Node | null | undefined): Node | undefined {
  return annotation?.type === "TSTypeAnnotation" ? annotation.typeAnnotation : undefined;
}

function typeAnnotationToCpp(typeAnnotation: Node | null | undefined, context: Context): string | undefined {
  if (!typeAnnotation) return undefined;

  switch (typeAnnotation.type) {
    case "TSNumberKeyword":
      return "double";
    case "TSBooleanKeyword":
      return "bool";
    case "TSStringKeyword":
      return "String";
    case "TSVoidKeyword":
      return "void";
    default:
      unsupported(context, `Unsupported TypeScript type annotation: ${typeAnnotation.type}`, typeAnnotation);
      return "auto";
  }
}

function getJsDocParamType(statement: FunctionDeclaration, name: string): string | undefined {
  const comments = getLeadingCommentText(statement);
  const pattern = new RegExp(`@param\\s+\\{([^}]+)\\}\\s+${escapeRegExp(name)}(?:\\s|$)`);
  return comments.match(pattern)?.[1];
}

function getJsDocReturnType(statement: FunctionDeclaration): string | undefined {
  const comments = getLeadingCommentText(statement);
  return comments.match(/@returns?\s+\{([^}]+)\}/)?.[1];
}

function getLeadingCommentText(node: Node): string {
  return node.leadingComments?.map((comment) => comment.value).join("\n") ?? "";
}

function jsDocTypeToCpp(type: string | undefined): string | undefined {
  switch (type?.trim()) {
    case "number":
      return "double";
    case "boolean":
      return "bool";
    case "string":
      return "String";
    case "void":
      return "void";
    default:
      return undefined;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferDeclarationType(declaration: VariableDeclarator, context: Context): string {
  return inferExpressionType(declaration.init, context) ?? "auto";
}

function inferExpressionType(expression: Node | null | undefined, context: Context): string | undefined {
  if (!expression) return undefined;

  switch (expression.type) {
    case "NumericLiteral":
      return Number.isInteger(expression.value) ? "int" : "double";
    case "BooleanLiteral":
      return "bool";
    case "StringLiteral":
    case "TemplateLiteral":
      return "String";
    case "UnaryExpression":
      return inferExpressionType(expression.argument, context);
    case "BinaryExpression":
      return inferBinaryExpressionType(expression.operator, expression.left, expression.right, context);
    case "LogicalExpression":
      return "bool";
    case "CallExpression":
      if (isCoreCall(expression, "millis", context) || isCoreCall(expression, "micros", context)) return "unsigned long";
      return undefined;
    default:
      return undefined;
  }
}

function inferBinaryExpressionType(operator: string, left: Node, right: Node, context: Context): string | undefined {
  if (["==", "!=", "===", "!==", "<", "<=", ">", ">="].includes(operator)) return "bool";
  const leftType = inferExpressionType(left, context);
  const rightType = inferExpressionType(right, context);
  if (leftType === "String" || rightType === "String") return "String";
  if (leftType === "double" || rightType === "double") return "double";
  if (leftType === "int" && rightType === "int") return "int";
  return undefined;
}

function arrayElementType(expression: Extract<Node, { type: "ArrayExpression" }>, context: Context): string {
  const types = expression.elements.map((element) => {
    if (!element || element.type === "SpreadElement") return undefined;
    return inferExpressionType(element, context);
  }).filter((type): type is string => Boolean(type));
  if (!types.length) return "auto";
  if (types.includes("String")) return "String";
  if (types.includes("double")) return "double";
  if (types.every((type) => type === "bool")) return "bool";
  if (types.every((type) => type === "int")) return "int";
  return "auto";
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

function arrayExpressionToCpp(expression: Extract<Node, { type: "ArrayExpression" }>, context: Context): string {
  const values = expression.elements.map((element) => {
    if (!element) {
      unsupported(context, "Sparse arrays are not supported.", expression);
      return "0";
    }
    if (element.type === "SpreadElement") {
      unsupported(context, "Array spread is not supported.", element);
      return "/* unsupported spread */";
    }
    return expressionToCpp(element, context);
  });
  return `{${values.join(", ")}}`;
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
  if (expression.property.type === "Identifier" && !expression.computed && expression.property.name === "length") {
    return `(sizeof(${object}) / sizeof(${object}[0]))`;
  }
  if (expression.property.type === "Identifier" && !expression.computed) return `${object}.${expression.property.name}`;
  return `${object}[${expressionToCpp(expression.property, context)}]`;
}

function indent(lines: string[]): string[] {
  return lines.map((line) => line ? `  ${line}` : line);
}

function indentMapped(lines: CppLine[]): CppLine[] {
  return lines.map((mappedLine) => ({
    ...mappedLine,
    code: mappedLine.code ? `  ${mappedLine.code}` : mappedLine.code
  }));
}

function mapLines(lines: string[], node?: Node): CppLine[] {
  const source = locationOf(node);
  return lines.map((code) => ({ code, source }));
}

function line(code: string, node?: Node): CppLine {
  return { code, source: locationOf(node) };
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
    (capability, node) => requireBoardCapability(capability, context, locationOf, node),
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
