export class OLED {
  constructor(public readonly width = 128, public readonly height = 64, public readonly address = 0x3c) {}
  begin(): void {}
  clear(): void {}
  display(): void {}
  setCursor(column: number, row: number): void {}
  textSize(size: number): void {}
  textColor(color: number): void {}
  print(value: string | number | boolean): void {}
}
