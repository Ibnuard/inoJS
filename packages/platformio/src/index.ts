import { getDefaultPlatform } from "@inojs/config";

export interface PlatformIOConfig {
  board: string;
  platform?: string;
  framework?: string;
  monitorSpeed?: number;
  libDeps?: string[];
}

export function generatePlatformIOIni(config: PlatformIOConfig): string {
  const platform = config.platform ?? getDefaultPlatform(config.board) ?? "atmelavr";
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
