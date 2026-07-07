export class NeoPixel {
  constructor(public readonly count: number, public readonly pinNumber: number) {}
  begin(): void {}
  show(): void {}
  clear(): void {}
  setPixelColor(pixel: number, red: number, green: number, blue: number): void {}
  brightness(value: number): void {}
}
