export interface PlatformIOConfig {
  board: string;
  platform?: string;
  framework?: string;
  monitorSpeed?: number;
  libDeps?: string[];
}

const defaultPlatforms: Record<string, string> = {
  uno: "atmelavr",
  nanoatmega328: "atmelavr",
  megaatmega2560: "atmelavr",
  due: "atmelsam",
  teensy41: "teensy",
  pico: "raspberrypi",
  rpipico: "raspberrypi",
  bluepill_f103c8: "ststm32",
  genericSTM32F103C8: "ststm32",
  nodemcuv2: "espressif8266",
  esp32dev: "espressif32"
};

export function generatePlatformIOIni(config: PlatformIOConfig): string {
  const platform = config.platform ?? defaultPlatforms[config.board] ?? "atmelavr";
  const framework = config.framework ?? "arduino";
  const lines = [
    "[env:inojs]",
    `platform = ${platform}`,
    `board = ${config.board}`,
    `framework = ${framework}`,
    `monitor_speed = ${config.monitorSpeed ?? 115200}`
  ];

  if (config.libDeps?.length) {
    lines.push("lib_deps =");
    for (const dep of config.libDeps) lines.push(`  ${dep}`);
  }

  return `${lines.join("\n")}\n`;
}
