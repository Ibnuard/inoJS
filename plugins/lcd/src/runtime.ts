export class LCD {
  constructor(
    public readonly address: number = 0x27,
    public readonly columns: number = 16,
    public readonly rows: number = 2
  ) {}

  begin(): void {}
  start(): void {}
  clear(): void {}
  line(row: number, value: string | number | boolean): void {}
  setCursor(column: number, row: number): void {}
  print(value: string | number | boolean): void {}
  backlight(): void {}
  noBacklight(): void {}
}
