import type { BoardCapability } from "@inojs/plugin-api";

export interface BoardProfile {
  id: string;
  platform: string;
  digitalPins: Set<number>;
  capabilities: Set<BoardCapability>;
}

export interface BoardProfileDefinition {
  platform: string;
  digitalPins: number[] | { start: number; end: number };
  capabilities?: BoardCapability[];
}

const boardProfileDefinitions = {
  uno: {
    platform: "atmelavr",
    digitalPins: { start: 0, end: 19 },
    capabilities: ["eeprom", "i2c", "spi"]
  },
  nanoatmega328: {
    platform: "atmelavr",
    digitalPins: { start: 0, end: 19 },
    capabilities: ["eeprom", "i2c", "spi"]
  },
  megaatmega2560: {
    platform: "atmelavr",
    digitalPins: { start: 0, end: 69 },
    capabilities: ["eeprom", "i2c", "spi"]
  },
  due: {
    platform: "atmelsam",
    digitalPins: { start: 0, end: 53 },
    capabilities: ["i2c", "spi"]
  },
  teensy41: {
    platform: "teensy",
    digitalPins: { start: 0, end: 54 },
    capabilities: ["eeprom", "i2c", "spi"]
  },
  pico: {
    platform: "raspberrypi",
    digitalPins: { start: 0, end: 28 },
    capabilities: ["i2c", "spi"]
  },
  rpipico: {
    platform: "raspberrypi",
    digitalPins: { start: 0, end: 28 },
    capabilities: ["i2c", "spi"]
  },
  bluepill_f103c8: {
    platform: "ststm32",
    digitalPins: { start: 0, end: 37 },
    capabilities: ["i2c", "spi"]
  },
  genericSTM32F103C8: {
    platform: "ststm32",
    digitalPins: { start: 0, end: 37 },
    capabilities: ["i2c", "spi"]
  },
  esp32dev: {
    platform: "espressif32",
    digitalPins: [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39],
    capabilities: ["bluetooth", "eeprom", "i2c", "spi", "wifi"]
  },
  nodemcuv2: {
    platform: "espressif8266",
    digitalPins: { start: 0, end: 16 },
    capabilities: ["eeprom", "i2c", "spi", "wifi"]
  }
} satisfies Record<string, BoardProfileDefinition>;

export type KnownBoardId = keyof typeof boardProfileDefinitions;

export const boardProfiles: Record<KnownBoardId, BoardProfile> = Object.fromEntries(
  Object.entries(boardProfileDefinitions).map(([id, definition]) => [
    id,
    {
      id,
      platform: definition.platform,
      digitalPins: pinsToSet(definition.digitalPins),
      capabilities: new Set(definition.capabilities ?? [])
    }
  ])
) as Record<KnownBoardId, BoardProfile>;

export function getBoardProfile(board: string | undefined): BoardProfile | undefined {
  if (!board) return undefined;
  return boardProfiles[board as KnownBoardId];
}

export function getDefaultPlatform(board: string): string | undefined {
  return getBoardProfile(board)?.platform;
}

export function boardSupportsCapability(board: string | undefined, capability: BoardCapability): boolean | undefined {
  const profile = getBoardProfile(board);
  return profile ? profile.capabilities.has(capability) : undefined;
}

export function isValidDigitalPin(board: string | undefined, pin: number): boolean | undefined {
  const profile = getBoardProfile(board);
  return profile ? profile.digitalPins.has(pin) : undefined;
}

function pinsToSet(pins: number[] | { start: number; end: number }): Set<number> {
  if (Array.isArray(pins)) return new Set(pins);

  const values = new Set<number>();
  for (let pin = pins.start; pin <= pins.end; pin += 1) values.add(pin);
  return values;
}
