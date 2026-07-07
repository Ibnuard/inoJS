import type { Node } from "@babel/types";
import type { Context } from "./context.js";

interface BoardPinProfile {
  digital: Set<number>;
}

const boardPins: Record<string, BoardPinProfile> = {
  uno: range(0, 19),
  nanoatmega328: range(0, 19),
  megaatmega2560: range(0, 69),
  due: range(0, 53),
  teensy41: range(0, 54),
  pico: range(0, 28),
  rpipico: range(0, 28),
  bluepill_f103c8: range(0, 37),
  genericSTM32F103C8: range(0, 37),
  esp32dev: set([0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39]),
  nodemcuv2: range(0, 16)
};

export function validatePinExpression(
  expression: Node | undefined | null,
  context: Context,
  locationOf: (node: Node | undefined) => { filename?: string; line: number; column: number } | undefined
): void {
  if (!expression || expression.type !== "NumericLiteral" || !context.board) return;

  const board = boardPins[context.board];
  if (!board || board.digital.has(expression.value)) return;

  context.diagnostics.push({
    level: "error",
    message: `Pin ${expression.value} is not valid for board ${context.board}.`,
    location: locationOf(expression)
  });
}

function range(start: number, end: number): BoardPinProfile {
  const digital = new Set<number>();
  for (let pin = start; pin <= end; pin += 1) digital.add(pin);
  return { digital };
}

function set(values: number[]): BoardPinProfile {
  return { digital: new Set(values) };
}
