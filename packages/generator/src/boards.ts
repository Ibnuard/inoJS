import type { Node } from "@babel/types";
import type { Context } from "./context.js";
import type { BoardCapability } from "@inojs/plugin-api";

interface BoardPinProfile {
  digital: Set<number>;
  capabilities: Set<BoardCapability>;
}

const boardPins: Record<string, BoardPinProfile> = {
  uno: range(0, 19, ["eeprom", "i2c", "spi"]),
  nanoatmega328: range(0, 19, ["eeprom", "i2c", "spi"]),
  megaatmega2560: range(0, 69, ["eeprom", "i2c", "spi"]),
  due: range(0, 53, ["i2c", "spi"]),
  teensy41: range(0, 54, ["eeprom", "i2c", "spi"]),
  pico: range(0, 28, ["i2c", "spi"]),
  rpipico: range(0, 28, ["i2c", "spi"]),
  bluepill_f103c8: range(0, 37, ["i2c", "spi"]),
  genericSTM32F103C8: range(0, 37, ["i2c", "spi"]),
  esp32dev: set([0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39], ["bluetooth", "eeprom", "i2c", "spi", "wifi"]),
  nodemcuv2: range(0, 16, ["eeprom", "i2c", "spi", "wifi"])
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

export function requireBoardCapability(
  capability: BoardCapability,
  context: Context,
  locationOf: (node: Node | undefined) => { filename?: string; line: number; column: number } | undefined,
  node?: Node
): void {
  if (!context.board) return;

  const board = boardPins[context.board];
  if (!board || board.capabilities.has(capability)) return;

  context.diagnostics.push({
    level: "error",
    message: `Board ${context.board} does not support ${capability}.`,
    location: locationOf(node)
  });
}

function range(start: number, end: number, capabilities: BoardCapability[] = []): BoardPinProfile {
  const digital = new Set<number>();
  for (let pin = start; pin <= end; pin += 1) digital.add(pin);
  return { digital, capabilities: new Set(capabilities) };
}

function set(values: number[], capabilities: BoardCapability[] = []): BoardPinProfile {
  return { digital: new Set(values), capabilities: new Set(capabilities) };
}
