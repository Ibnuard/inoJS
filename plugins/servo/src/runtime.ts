export class Servo {
  constructor(public readonly pinNumber?: number) {}
  attach(pinNumber?: number): void {}
  write(angle: number): void {}
  detach(): void {}
}
