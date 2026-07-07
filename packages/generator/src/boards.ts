import type { Node } from "@babel/types";
import type { Context } from "./context.js";
import type { BoardCapability } from "@inojs/plugin-api";
import { boardSupportsCapability, isValidDigitalPin } from "@inojs/config";

export function validatePinExpression(
  expression: Node | undefined | null,
  context: Context,
  locationOf: (node: Node | undefined) => { filename?: string; line: number; column: number } | undefined
): void {
  if (!expression || expression.type !== "NumericLiteral" || !context.board) return;

  const valid = isValidDigitalPin(context.board, expression.value);
  if (valid !== false) return;

  context.diagnostics.push({
    level: "error",
    message: `Pin ${expression.value} is not valid for board ${context.board}.`,
    location: locationOf(expression)
  });
}

export function requireBoardCapability(
  capability: BoardCapability,
  context: Context,
  locationOf: (node: Node | undefined) => { filename?: string; line: number; column: number } | undefined,
  node?: Node
): void {
  if (!context.board) return;

  const supported = boardSupportsCapability(context.board, capability);
  if (supported !== false) return;

  context.diagnostics.push({
    level: "error",
    message: `Board ${context.board} does not support ${capability}.`,
    location: locationOf(node)
  });
}
